import type { APIRoute } from "astro";
import { z } from "zod";
import type {
  CardDTO,
  DueCardsListDTO,
  ErrorResponse,
  ValidationErrorResponse,
  HttpStatus,
} from "../../../../../../types";
import { formatZodErrors } from "../../../../../../lib/utils/zod-errors";

// Disable pre-rendering for this API route
export const prerender = false;

/**
 * Query parameters validation schema for GET /api/v1/decks/{deckId}/cards/due
 */
const dueCardsQuerySchema = z.object({
  before: z
    .preprocess(
      (val) => (val === null || val === undefined || val === "" ? new Date().toISOString() : val),
      z.string().datetime({ message: "Invalid ISO-8601 date format" })
    )
    .default(new Date().toISOString()),
  limit: z
    .preprocess((val) => (val === null || val === undefined ? "50" : val), z.coerce.number().int().min(1).max(100))
    .default(50),
  offset: z
    .preprocess((val) => (val === null || val === undefined ? "0" : val), z.coerce.number().int().min(0))
    .default(0),
  sort: z.enum(["nextReviewDate"]).default("nextReviewDate"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

/**
 * Validates if a string is a valid UUID v4
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * GET /api/v1/decks/{deckId}/cards/due
 *
 * Retrieves a paginated list of cards due for review from a specific deck.
 * Cards are considered "due" when their next_review_date is less than or equal to the "before" parameter.
 *
 * Authentication: Required (Bearer token)
 * Authorization: User must own the deck
 *
 * Path Parameters:
 * - deckId: string (UUID) - ID of the deck
 *
 * Query Parameters:
 * - before: string (ISO-8601, default: now) - Cards due before this date/time
 * - limit: number (1-100, default 50) - Cards per page
 * - offset: number (≥0, default 0) - Pagination offset
 * - sort: enum (nextReviewDate, default nextReviewDate) - Sort field
 * - order: enum (asc|desc, default asc) - Sort direction
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
 * - 400 Bad Request: Invalid query parameters or deckId format
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
      console.warn("[GET /api/v1/decks/{deckId}/cards/due] Authentication failed:", {
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
        status: 401 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 2: Validate Path Parameter (deckId)
    // =========================================================================
    const { deckId } = params;

    if (!deckId || !isValidUUID(deckId)) {
      console.warn("[GET /api/v1/decks/{deckId}/cards/due] Invalid deckId format:", {
        deckId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid deck ID format",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 3: Validate Query Parameters
    // =========================================================================
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validationResult = dueCardsQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const validationErrors = formatZodErrors(validationResult.error);

      console.warn("[GET /api/v1/decks/{deckId}/cards/due] Query validation failed:", {
        deckId,
        userId: user.id,
        errors: validationErrors,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ValidationErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          errors: validationErrors,
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { before, limit, offset, order } = validationResult.data;

    // =========================================================================
    // STEP 4: Verify Deck Ownership
    // =========================================================================
    const { data: deck, error: deckError } = await locals.supabase
      .from("decks")
      .select("id")
      .eq("id", deckId)
      .eq("user_id", user.id)
      .single();

    if (deckError || !deck) {
      console.warn("[GET /api/v1/decks/{deckId}/cards/due] Deck not found or access denied:", {
        deckId,
        userId: user.id,
        error: deckError?.message,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "DECK_NOT_FOUND",
          message: "Deck not found",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 404 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 5: Query Due Cards with Pagination
    // =========================================================================
    const dbSortColumn = "next_review_date";
    const ascending = order === "asc";

    // Get due cards with pagination
    const { data: cards, error: cardsError } = await locals.supabase
      .from("cards")
      .select("*")
      .eq("deck_id", deckId)
      .lte("next_review_date", before)
      .order(dbSortColumn, { ascending })
      .range(offset, offset + limit - 1);

    if (cardsError) {
      console.error("[GET /api/v1/decks/{deckId}/cards/due] Database query failed:", {
        deckId,
        userId: user.id,
        error: cardsError.message,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve due cards",
          details: "Database query failed",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 6: Get Total Count of Due Cards
    // =========================================================================
    const { count, error: countError } = await locals.supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("deck_id", deckId)
      .lte("next_review_date", before);

    if (countError) {
      console.error("[GET /api/v1/decks/{deckId}/cards/due] Count query failed:", {
        deckId,
        userId: user.id,
        error: countError.message,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to count due cards",
          details: "Database count query failed",
        },
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // STEP 7: Map Database Results to DTOs
    // =========================================================================
    const cardDTOs: CardDTO[] = (cards || []).map((card) => ({
      id: card.id,
      deckId: card.deck_id,
      question: card.question,
      answer: card.answer,
      easeFactor: card.ease_factor,
      intervalDays: card.interval_days,
      repetitions: card.repetitions,
      nextReviewDate: card.next_review_date,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
    }));

    const response: DueCardsListDTO = {
      items: cardDTOs,
      total: count || 0,
      limit,
      offset,
    };

    // =========================================================================
    // STEP 8: Log Success and Return Response
    // =========================================================================
    console.info("[GET /api/v1/decks/{deckId}/cards/due] Success:", {
      deckId,
      userId: user.id,
      total: count,
      returned: cardDTOs.length,
      before,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify(response), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // =========================================================================
    // STEP 9: Handle Unexpected Errors
    // =========================================================================
    console.error("[GET /api/v1/decks/{deckId}/cards/due] Unexpected error:", {
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
      status: 500 as HttpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
};
