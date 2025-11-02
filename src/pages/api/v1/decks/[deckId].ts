import type { APIRoute } from "astro";

import { DeckService } from "@/lib/services/deck.service";
import { UpdateDeckSchema } from "@/lib/validation/deck.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import type { DeckDTO, ErrorCode, ErrorResponse, HttpStatus } from "@/types";

// Disable pre-rendering for this API route
export const prerender = false;

/**
 * Validates if a string is a valid UUID v4
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * GET /api/v1/decks/{deckId}
 *
 * Retrieves a single deck by ID for the authenticated user.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - Validates deckId as valid UUID
 * - User can only access their own decks (RLS enforcement)
 * - Returns 404 if deck not found or doesn't belong to user
 *
 * @param {string} deckId - UUID of the deck (path parameter)
 * @returns {DeckDTO} 200 OK - Deck data retrieved successfully
 * @returns {ErrorResponse} 400 Bad Request - Invalid UUID format
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 404 Not Found - Deck not found or doesn't belong to user
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 *
 * @example
 * GET /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
 * Authorization: Bearer <token>
 *
 * Response (200 OK):
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "My Deck",
 *   "createdByAi": false,
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z"
 * }
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate deckId from path parameter
    const { deckId } = params;

    if (!deckId || !isValidUUID(deckId)) {
      console.warn("[GET /api/v1/decks/{deckId}] Invalid UUID format:", {
        deckId,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST" as ErrorCode,
          message: "Invalid deck ID format",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 2: Check authentication
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[GET /api/v1/decks/{deckId}] Authentication failed:", {
        error: authError?.message,
        deckId,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED" as ErrorCode,
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 3: Fetch deck through service
    const deck = await DeckService.getDeckById(deckId, user.id, locals.supabase);

    // Step 4: Handle deck not found (or doesn't belong to user)
    if (!deck) {
      console.warn("[GET /api/v1/decks/{deckId}] Deck not found:", {
        deckId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND" as ErrorCode,
          message: "Deck not found",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 5: Log success (for audit)
    console.info("[GET /api/v1/decks/{deckId}] Deck fetched successfully:", {
      deckId,
      userId: user.id,
      deckName: deck.name,
      timestamp: new Date().toISOString(),
    });

    // Step 6: Success - return deck
    const successResponse: DeckDTO = deck;

    return new Response(JSON.stringify(successResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("[GET /api/v1/decks/{deckId}] Internal server error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      deckId: params.deckId,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR" as ErrorCode,
        message: "An unexpected error occurred",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500 as HttpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * PATCH /api/v1/decks/{deckId}
 *
 * Updates a deck's name for the authenticated user.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - Validates deckId as valid UUID
 * - Validates request body (name field)
 * - User can only update their own decks (RLS enforcement)
 * - Returns 404 if deck not found or doesn't belong to user
 * - Partial update (only name can be updated)
 *
 * @param {string} deckId - UUID of the deck (path parameter)
 * @body {UpdateDeckCommand} Request body with optional name field
 * @returns {DeckDTO} 200 OK - Deck updated successfully
 * @returns {ValidationErrorResponse} 400 Bad Request - Invalid UUID or validation error
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 404 Not Found - Deck not found or doesn't belong to user
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 *
 * @example
 * PATCH /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Deck Name"
 * }
 *
 * Response (200 OK):
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Updated Deck Name",
 *   "createdByAi": false,
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T14:45:00.000Z"
 * }
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    // Step 1: Extract and validate deckId from path parameter
    const { deckId } = params;

    if (!deckId || !isValidUUID(deckId)) {
      console.warn("[PATCH /api/v1/decks/{deckId}] Invalid UUID format:", {
        deckId,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST" as ErrorCode,
          message: "Invalid deck ID format",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 2: Check authentication
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[PATCH /api/v1/decks/{deckId}] Authentication failed:", {
        error: authError?.message,
        deckId,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED" as ErrorCode,
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 3: Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.warn("[PATCH /api/v1/decks/{deckId}] Invalid JSON in request body:", {
        error: error instanceof Error ? error.message : String(error),
        deckId,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST" as ErrorCode,
          message: "Invalid JSON in request body",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 4: Validate with Zod
    const validationResult = UpdateDeckSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = formatZodErrors(validationResult.error);

      console.warn("[PATCH /api/v1/decks/{deckId}] Validation failed:", {
        errors,
        body,
        deckId,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            errors,
          },
        }),
        {
          status: 400 as HttpStatus,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Update deck through service
    const updatedDeck = await DeckService.updateDeck(deckId, user.id, validationResult.data, locals.supabase);

    // Step 6: Handle deck not found (or doesn't belong to user)
    if (!updatedDeck) {
      console.warn("[PATCH /api/v1/decks/{deckId}] Deck not found:", {
        deckId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND" as ErrorCode,
          message: "Deck not found",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 7: Log success (for audit)
    console.info("[PATCH /api/v1/decks/{deckId}] Deck updated successfully:", {
      deckId,
      userId: user.id,
      changes: validationResult.data,
      timestamp: new Date().toISOString(),
    });

    // Step 8: Success - return updated deck
    const successResponse: DeckDTO = updatedDeck;

    return new Response(JSON.stringify(successResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("[PATCH /api/v1/decks/{deckId}] Internal server error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      deckId: params.deckId,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR" as ErrorCode,
        message: "An unexpected error occurred",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500 as HttpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * DELETE /api/v1/decks/{deckId}
 * Delete a deck and all its cards/reviews (CASCADE)
 *
 * @security JWT Bearer Token (Authorization header)
 *
 * @param {string} deckId - Deck UUID (path parameter)
 *
 * @returns {204} - No Content (deck successfully deleted)
 * @returns {400} - Bad Request (invalid UUID format)
 * @returns {401} - Unauthorized (missing or invalid JWT token)
 * @returns {404} - Not Found (deck doesn't exist or doesn't belong to user)
 * @returns {500} - Internal Server Error
 *
 * @example
 * DELETE /api/v1/decks/550e8400-e29b-41d4-a716-446655440000
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * Response: 204 No Content
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // Step 1: Extract and validate deck ID from path parameter
    const deckId = params.deckId;

    if (!deckId || !isValidUUID(deckId)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST" as ErrorCode,
          message: "Invalid deck ID format",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 2: Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED" as ErrorCode,
          message: "Authentication required",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 3: Delete deck via service (CASCADE will delete all cards/reviews)
    const deleted = await DeckService.deleteDeck(deckId, user.id, locals.supabase);

    // Step 4: Return 404 if deck not found or doesn't belong to user
    if (!deleted) {
      const errorResponse: ErrorResponse = {
        error: {
          code: "NOT_FOUND" as ErrorCode,
          message: "Deck not found",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 5: Log successful deletion (for audit)
    console.info("[DELETE /api/v1/decks/{deckId}] Deck deleted successfully:", {
      deckId,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    // Step 6: Return 204 No Content on successful deletion
    return new Response(null, {
      status: 204 as HttpStatus,
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("[DELETE /api/v1/decks/{deckId}] Internal server error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      deckId: params.deckId,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR" as ErrorCode,
        message: "An unexpected error occurred",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500 as HttpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
};
