import type { APIRoute } from "astro";
import { z } from "zod";
import type {
  ReviewResponseDTO,
  CreateReviewCommand,
  ErrorResponse,
  ValidationErrorResponse,
} from "../../../../../types";
import { ReviewService } from "../../../../../lib/services/review.service";
import { CreateReviewSchema, CardIdSchema } from "../../../../../lib/validation/review.schemas";
import { formatZodErrors } from "../../../../../lib/utils/zod-errors";

export const prerender = false;

/**
 * POST /api/v1/cards/{cardId}/review
 * Submit a review grade and update SM-2 parameters
 *
 * Request Body:
 * {
 *   "grade": 0-5,
 *   "reviewDate"?: "ISO-8601 timestamp"
 * }
 *
 * Response (200 OK):
 * {
 *   "card": {
 *     "id": "uuid",
 *     "easeFactor": number,
 *     "intervalDays": number,
 *     "repetitions": number,
 *     "nextReviewDate": "ISO-8601",
 *     "updatedAt": "ISO-8601"
 *   },
 *   "review": {
 *     "id": "uuid",
 *     "cardId": "uuid",
 *     "userId": "uuid",
 *     "grade": 0-5,
 *     "reviewDate": "ISO-8601"
 *   }
 * }
 *
 * Error Responses:
 * - 400: Validation error (invalid grade or date format)
 * - 401: Authentication required
 * - 403: Access denied to this card
 * - 404: Card not found
 * - 422: Failed to process review
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    // =========================================================================
    // STEP 1: Authentication
    // =========================================================================
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[POST /api/v1/cards/{cardId}/review] Unauthorized:", {
        authError: authError?.message,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 2: Validate Card ID Path Parameter
    // =========================================================================
    let cardId: string;
    try {
      cardId = CardIdSchema.parse(params.cardId);
    } catch (error) {
      console.warn("[POST /api/v1/cards/{cardId}/review] Invalid card ID:", {
        cardId: params.cardId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);

        const validationErrorResponse: ValidationErrorResponse = {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid card ID format",
            errors,
          },
        };

        return new Response(JSON.stringify(validationErrorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid card ID",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 3: Parse and Validate Request Body
    // =========================================================================
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.warn("[POST /api/v1/cards/{cardId}/review] Invalid JSON in request body:", {
        cardId,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid JSON in request body",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let validated: CreateReviewCommand;
    try {
      validated = CreateReviewSchema.parse(requestBody) as CreateReviewCommand;
    } catch (error) {
      console.warn("[POST /api/v1/cards/{cardId}/review] Request validation failed:", {
        cardId,
        userId: user.id,
        body: requestBody,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);

        const validationErrorResponse: ValidationErrorResponse = {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            errors,
          },
        };

        return new Response(JSON.stringify(validationErrorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw error;
    }

    // =========================================================================
    // STEP 4: Create Review and Update Card SM-2 Parameters
    // =========================================================================
    const result = await ReviewService.createReview(locals.supabase, cardId, user.id, validated);

    if ("error" in result) {
      // Map service errors to HTTP responses
      if (result.error === "CARD_NOT_FOUND") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "CARD_NOT_FOUND",
            message: "Card not found",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (result.error === "FORBIDDEN") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "FORBIDDEN",
            message: "Access denied to this card",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (result.error === "UNPROCESSABLE_ENTITY" || result.error === "DATABASE_ERROR") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Failed to process review",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Generic fallback for other errors
      throw new Error(`Unexpected error: ${result.error}`);
    }

    // =========================================================================
    // STEP 5: Return Success Response
    // =========================================================================
    console.info("[POST /api/v1/cards/{cardId}/review] Review created:", {
      cardId,
      userId: user.id,
      grade: validated.grade,
      reviewId: result.review.id,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // =========================================================================
    // STEP 6: Handle Unexpected Errors
    // =========================================================================
    console.error("[POST /api/v1/cards/{cardId}/review] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
