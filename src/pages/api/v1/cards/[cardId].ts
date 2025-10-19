import type { APIRoute } from "astro";
import type {
  CardDTO,
  UpdateCardCommand,
  ErrorResponse,
  ValidationErrorResponse,
} from "../../../../types";
import { CardService } from "../../../../lib/services/card.service";
import {
  updateCardSchema,
  cardIdParamSchema,
} from "../../../../lib/validation/card.schemas";
import { formatZodErrors } from "../../../../lib/utils/zod-errors";

/**
 * GET /api/v1/cards/{cardId}
 *
 * Retrieves a single card by ID with full details including SM-2 fields.
 * Verifies card ownership via deck ownership check.
 *
 * Authentication: Required (Bearer token)
 * Authorization: User must own the card (via deck ownership)
 *
 * Success Response: 200 OK
 * {
 *   "id": "uuid",
 *   "deckId": "uuid",
 *   "question": "...",
 *   "answer": "...",
 *   "easeFactor": 2.5,
 *   "intervalDays": 1,
 *   "repetitions": 0,
 *   "nextReviewDate": "ISO-8601",
 *   "createdAt": "ISO-8601",
 *   "updatedAt": "ISO-8601"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid cardId format
 * - 401 Unauthorized: Missing or invalid token
 * - 404 Not Found: Card doesn't exist or doesn't belong to user
 * - 500 Internal Server Error: Unexpected error
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // =========================================================================
    // STEP 1: Authentication Check
    // =========================================================================
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[GET /api/v1/cards/{cardId}] Authentication failed:", {
        error: authError?.message,
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
    // STEP 2: Path Parameter Validation
    // =========================================================================
    const cardIdValidation = cardIdParamSchema.safeParse(params.cardId);

    if (!cardIdValidation.success) {
      console.warn("[GET /api/v1/cards/{cardId}] Invalid cardId format:", {
        cardId: params.cardId,
        userId: user.id,
        error: cardIdValidation.error.errors[0]?.message,
        timestamp: new Date().toISOString(),
      });

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

    const cardId = cardIdValidation.data;

    // =========================================================================
    // STEP 3: Get Card with Ownership Verification
    // =========================================================================
    // Use CardService to get card (includes ownership verification)
    const card = await CardService.getCardById(locals.supabase, cardId, user.id);

    if (!card) {
      console.warn("[GET /api/v1/cards/{cardId}] Card not found or access denied:", {
        cardId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

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

    // =========================================================================
    // STEP 4: Return Success Response
    // =========================================================================
    console.info("[GET /api/v1/cards/{cardId}] Card retrieved successfully:", {
      cardId,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET /api/v1/cards/{cardId}] Unexpected error:", {
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

/**
 * PATCH /api/v1/cards/{cardId}
 *
 * Updates a card's question and/or answer.
 * SM-2 fields (easeFactor, intervalDays, repetitions, nextReviewDate) are ignored
 * and can only be modified via the review endpoint.
 *
 * Authentication: Required (Bearer token)
 * Authorization: User must own the card (via deck ownership)
 *
 * Request Body:
 * {
 *   "question"?: string (1-10,000 chars),
 *   "answer"?: string (1-10,000 chars)
 * }
 * Note: At least one field must be provided
 *
 * Success Response: 200 OK
 * {
 *   "id": "uuid",
 *   "deckId": "uuid",
 *   "question": "...",
 *   "answer": "...",
 *   "easeFactor": 2.5,
 *   "intervalDays": 1,
 *   "repetitions": 0,
 *   "nextReviewDate": "ISO-8601",
 *   "createdAt": "ISO-8601",
 *   "updatedAt": "ISO-8601"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Validation errors (empty fields, no fields provided, etc.)
 * - 401 Unauthorized: Missing or invalid token
 * - 403 Forbidden: Card doesn't belong to user
 * - 404 Not Found: Card doesn't exist
 * - 422 Unprocessable Entity: Database constraint violation
 * - 500 Internal Server Error: Unexpected error
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    // =========================================================================
    // STEP 1: Authentication Check
    // =========================================================================
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
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
    // STEP 2: Path Parameter Validation
    // =========================================================================
    const cardIdValidation = cardIdParamSchema.safeParse(params.cardId);

    if (!cardIdValidation.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid card ID format",
          details: cardIdValidation.error.errors[0]?.message,
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cardId = cardIdValidation.data;

    // =========================================================================
    // STEP 3: Request Body Validation
    // =========================================================================
    let requestBody: unknown;
    try {
      requestBody = await request.json();
    } catch {
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

    const validation = updateCardSchema.safeParse(requestBody);

    if (!validation.success) {
      const validationErrors = formatZodErrors(validation.error);
      const errorResponse: ValidationErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          errors: validationErrors,
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const command: UpdateCardCommand = validation.data;

    // =========================================================================
    // STEP 4: Update Card in Database (with ownership verification)
    // =========================================================================
    const result = await CardService.updateCard(
      locals.supabase,
      cardId,
      user.id,
      command
    );

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

      if (result.error === "DATABASE_ERROR") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "UNPROCESSABLE_ENTITY",
            message: "Failed to update card due to database constraints",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Default to internal server error
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

    // =========================================================================
    // STEP 5: Return Success Response
    // =========================================================================
    const cardDTO: CardDTO = result;

    return new Response(JSON.stringify(cardDTO), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[PATCH /api/v1/cards/{cardId}] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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

/**
 * DELETE /api/v1/cards/{cardId}
 *
 * Permanently deletes a card from the database (hard delete).
 * Automatically cascades to delete related reviews via foreign key constraint.
 *
 * Authentication: Required (Bearer token)
 * Authorization: User must own the card (via deck ownership)
 *
 * Success Response: 200 OK
 * {
 *   "status": "deleted"
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid token
 * - 404 Not Found: Card doesn't exist or doesn't belong to user
 * - 500 Internal Server Error: Unexpected error
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // =========================================================================
    // STEP 1: Authentication Check
    // =========================================================================
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[DELETE /api/v1/cards/{cardId}] Authentication failed:", {
        error: authError?.message,
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
    // STEP 2: Path Parameter Validation
    // =========================================================================
    const cardIdValidation = cardIdParamSchema.safeParse(params.cardId);

    if (!cardIdValidation.success) {
      console.warn("[DELETE /api/v1/cards/{cardId}] Invalid cardId format:", {
        cardId: params.cardId,
        userId: user.id,
        error: cardIdValidation.error.errors[0]?.message,
        timestamp: new Date().toISOString(),
      });

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

    const cardId = cardIdValidation.data;

    // =========================================================================
    // STEP 3: Card Ownership Verification
    // =========================================================================
    // Verify card exists and belongs to user by joining with decks table
    const { data: card, error: cardError } = await locals.supabase
      .from("cards")
      .select(
        `
        id,
        deck:decks!inner(user_id)
      `
      )
      .eq("id", cardId)
      .eq("deck.user_id", user.id)
      .single();

    if (cardError || !card) {
      console.warn(
        "[DELETE /api/v1/cards/{cardId}] Card not found or access denied:",
        {
          cardId,
          userId: user.id,
          error: cardError?.message,
          code: cardError?.code,
          timestamp: new Date().toISOString(),
        }
      );

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

    // =========================================================================
    // STEP 4: Delete Card from Database
    // =========================================================================
    // Hard delete - will cascade to reviews table via FK constraint
    const { error: deleteError } = await locals.supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error("[DELETE /api/v1/cards/{cardId}] Delete failed:", {
        cardId,
        userId: user.id,
        error: deleteError.message,
        code: deleteError.code,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete card",
          details: "Database delete operation failed",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 5: Return Success Response
    // =========================================================================
    console.info("[DELETE /api/v1/cards/{cardId}] Card deleted successfully:", {
      cardId,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    const response = {
      status: "deleted",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[DELETE /api/v1/cards/{cardId}] Unexpected error:", {
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

// Disable prerendering for API route
export const prerender = false;
