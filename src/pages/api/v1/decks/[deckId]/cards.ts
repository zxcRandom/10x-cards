import type { APIRoute } from "astro";
import { z } from "zod";
import type {
  CardDTO,
  CardsListDTO,
  CreateCardCommand,
  ErrorResponse,
  ValidationErrorResponse,
  HttpStatus,
} from "../../../../../types";
import { CardService } from "../../../../../lib/services/card.service.legacy";
import {
  createCardSchema,
  deckIdParamSchema,
} from "../../../../../lib/validation/card.schemas";
import { formatZodErrors } from "../../../../../lib/utils/zod-errors";

// Disable prerendering for API route
export const prerender = false;

/**
 * Query parameters validation schema for GET /api/v1/decks/{deckId}/cards
 */
const cardsListQuerySchema = z.object({
  limit: z
    .preprocess(
      (val) => (val === null || val === undefined ? "20" : val),
      z.coerce.number().int().min(1).max(100)
    )
    .default(20),
  offset: z
    .preprocess(
      (val) => (val === null || val === undefined ? "0" : val),
      z.coerce.number().int().min(0)
    )
    .default(0),
  sort: z
    .preprocess(
      (val) => (val === null || val === undefined ? "createdAt" : val),
      z.enum([
        "createdAt",
        "updatedAt",
        "nextReviewDate",
        "easeFactor",
        "intervalDays",
        "repetitions",
        "question",
        "answer",
      ])
    )
    .default("createdAt"),
  order: z
    .preprocess(
      (val) => (val === null || val === undefined ? "desc" : val),
      z.enum(["asc", "desc"])
    )
    .default("desc"),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal(null))
    .transform((val) => (val === null ? undefined : val)),
});

/**
 * GET /api/v1/decks/{deckId}/cards
 *
 * Lists all cards in a deck with pagination, sorting, and filtering.
 *
 * Authentication: Required (Bearer token)
 * Authorization: User must own the deck
 *
 * Query Parameters:
 * - limit: number (1-100, default 20) - Cards per page
 * - offset: number (≥0, default 0) - Pagination offset
 * - sort: enum (createdAt|updatedAt|nextReviewDate|easeFactor|intervalDays|repetitions, default createdAt)
 * - order: enum (asc|desc, default desc)
 * - q: string (max 100 chars) - Search in question text
 *
 * Success Response: 200 OK
 * {
 *   "items": CardDTO[],
 *   "total": number,
 *   "limit": number,
 *   "offset": number
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid query parameters
 * - 401 Unauthorized: Missing or invalid token
 * - 403 Forbidden: Deck doesn't belong to user
 * - 404 Not Found: Deck doesn't exist
 * - 500 Internal Server Error: Unexpected error
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
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
    const deckIdValidation = deckIdParamSchema.safeParse(params.deckId);

    if (!deckIdValidation.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid deck ID format",
          details: deckIdValidation.error.errors[0]?.message,
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const deckId = deckIdValidation.data;

    // =========================================================================
    // STEP 3: Query Parameters Validation
    // =========================================================================
    const queryParams = {
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
      sort: url.searchParams.get("sort"),
      order: url.searchParams.get("order"),
      q: url.searchParams.get("q"),
    };

    const queryValidation = cardsListQuerySchema.safeParse(queryParams);

    if (!queryValidation.success) {
      const validationErrors = formatZodErrors(queryValidation.error);
      const errorResponse: ValidationErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          errors: validationErrors,
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const options = queryValidation.data;

    // =========================================================================
    // STEP 4: List Cards from Database
    // =========================================================================
    const result = await CardService.listCards(
      locals.supabase,
      deckId,
      user.id,
      options
    );

    if ("error" in result) {
      // Map service errors to HTTP responses
      if (result.error === "DECK_NOT_FOUND") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "DECK_NOT_FOUND",
            message: "Deck not found",
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
            message: "Access denied to this deck",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (result.error === "DATABASE_ERROR") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve cards",
            details: "Database query failed",
          },
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
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
    const cardsListDTO: CardsListDTO = result;

    return new Response(JSON.stringify(cardsListDTO), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET /api/v1/decks/{deckId}/cards] Unexpected error:", {
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
 * POST /api/v1/decks/{deckId}/cards
 *
 * Creates a new card in the specified deck with SM-2 default values.
 *
 * Authentication: Required (Bearer token)
 * Authorization: User must own the deck
 *
 * Request Body:
 * {
 *   "question": string (1-10,000 chars),
 *   "answer": string (1-10,000 chars)
 * }
 *
 * Success Response: 201 Created
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
 * - 400 Bad Request: Validation errors
 * - 401 Unauthorized: Missing or invalid token
 * - 403 Forbidden: Deck doesn't belong to user
 * - 404 Not Found: Deck doesn't exist
 * - 422 Unprocessable Entity: Database constraint violation
 * - 500 Internal Server Error: Unexpected error
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
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
    const deckIdValidation = deckIdParamSchema.safeParse(params.deckId);

    if (!deckIdValidation.success) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid deck ID format",
          details: deckIdValidation.error.errors[0]?.message,
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const deckId = deckIdValidation.data;

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

    const validation = createCardSchema.safeParse(requestBody);

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

    const command: CreateCardCommand = validation.data;

    // =========================================================================
    // STEP 4: Deck Ownership Verification
    // =========================================================================
    const { exists, owned } = await CardService.verifyDeckOwnership(
      locals.supabase,
      deckId,
      user.id
    );

    if (!exists) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "DECK_NOT_FOUND",
          message: "Deck not found",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!owned) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "FORBIDDEN",
          message: "You don't have permission to add cards to this deck",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 5: Create Card in Database
    // =========================================================================
    const result = await CardService.createCard(
      locals.supabase,
      deckId,
      command
    );

    if ("error" in result) {
      // Map service errors to HTTP responses
      if (result.error === "DECK_NOT_FOUND") {
        const errorResponse: ErrorResponse = {
          error: {
            code: "DECK_NOT_FOUND",
            message: "Deck not found",
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
            message: "Failed to create card due to database constraints",
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
    // STEP 6: Return Success Response
    // =========================================================================
    const cardDTO: CardDTO = result;

    return new Response(JSON.stringify(cardDTO), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[POST /api/v1/decks/{deckId}/cards] Unexpected error:", {
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
