import type { APIRoute } from "astro";

import { DeckService } from "@/lib/services/deck.service";
import { CreateDeckSchema, ListDecksQuerySchema } from "@/lib/validation/deck.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import type { DeckDTO, DecksListDTO, ErrorCode, ErrorResponse, HttpStatus } from "@/types";

// Disable pre-rendering for this API route
export const prerender = false;

/**
 * GET /api/v1/decks
 *
 * Lists decks owned by the authenticated user with pagination, sorting, and filtering.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - Supports pagination (limit, offset)
 * - Supports sorting by createdAt, updatedAt, or name
 * - Supports filtering by createdByAi flag
 * - Supports search by name (case-insensitive, partial match)
 * - User ID is extracted from verified JWT token
 * - Enforces Row Level Security (user can only see their own decks)
 *
 * @query {number} limit - Results per page (1-100, default 20)
 * @query {number} offset - Pagination offset (default 0)
 * @query {string} sort - Sort field: createdAt|updatedAt|name (default createdAt)
 * @query {string} order - Sort order: asc|desc (default desc)
 * @query {boolean} createdByAi - Filter by AI-generated flag (optional)
 * @query {string} q - Search in deck name (optional)
 * @returns {DecksListDTO} 200 OK - Paginated list of decks
 * @returns {ValidationErrorResponse} 400 Bad Request - Invalid query parameters
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 *
 * @example
 * GET /api/v1/decks?limit=10&sort=name&order=asc&createdByAi=true
 * Authorization: Bearer <token>
 *
 * Response (200 OK):
 * {
 *   "items": [
 *     {
 *       "id": "550e8400-e29b-41d4-a716-446655440000",
 *       "name": "AI Generated Deck",
 *       "createdByAi": true,
 *       "createdAt": "2024-01-15T10:30:00.000Z",
 *       "updatedAt": "2024-01-15T10:30:00.000Z"
 *     }
 *   ],
 *   "total": 1,
 *   "limit": 10,
 *   "offset": 0
 * }
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Step 1: Check authentication
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[GET /api/v1/decks] Authentication failed:", {
        error: authError?.message,
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

    // Step 2: Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validationResult = ListDecksQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const errors = formatZodErrors(validationResult.error);

      console.warn("[GET /api/v1/decks] Validation failed:", {
        errors,
        queryParams,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            errors,
          },
        }),
        {
          status: 400 as HttpStatus,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 3: Fetch decks through service
    const decks = await DeckService.listDecks(
      user.id,
      validationResult.data,
      locals.supabase
    );

    // Step 4: Log success (for monitoring)
    console.info("[GET /api/v1/decks] Decks fetched successfully:", {
      userId: user.id,
      total: decks.total,
      returned: decks.items.length,
      params: validationResult.data,
      timestamp: new Date().toISOString(),
    });

    // Step 5: Success - return paginated list
    const successResponse: DecksListDTO = decks;

    return new Response(JSON.stringify(successResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("[GET /api/v1/decks] Internal server error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
 * POST /api/v1/decks
 *
 * Creates a new deck for the authenticated user.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - Validates deck name (non-empty, max 255 characters)
 * - Optional AI-generated flag
 * - User ID is extracted from verified JWT token (never from request body)
 * - Enforces Row Level Security (user can only create their own decks)
 *
 * @body {CreateDeckCommand} Request body with deck name and optional createdByAi flag
 * @returns {DeckDTO} 201 Created - Deck created successfully with Location header
 * @returns {ValidationErrorResponse} 400 Bad Request - Invalid request body or validation error
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 *
 * @example
 * POST /api/v1/decks
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "name": "Geography of Europe",
 *   "createdByAi": false
 * }
 *
 * Response (201 Created):
 * Location: /api/v1/decks/{deckId}
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Geography of Europe",
 *   "createdByAi": false,
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z"
 * }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Step 1: Check authentication
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[POST /api/v1/decks] Authentication failed:", {
        error: authError?.message,
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

    // Step 2: Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.warn("[POST /api/v1/decks] Invalid JSON in request body:", {
        error: error instanceof Error ? error.message : String(error),
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

    // Step 3: Validate with Zod
    const validationResult = CreateDeckSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = formatZodErrors(validationResult.error);

      console.warn("[POST /api/v1/decks] Validation failed:", {
        errors,
        body,
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

    // Step 4: Create deck through service
    const createdDeck = await DeckService.createDeck(
      user.id,
      validationResult.data,
      locals.supabase
    );

    // Step 5: Log success (for audit)
    console.info("[POST /api/v1/decks] Deck created successfully:", {
      userId: user.id,
      deckId: createdDeck.id,
      deckName: createdDeck.name,
      createdByAi: createdDeck.createdByAi,
      timestamp: new Date().toISOString(),
    });

    // Step 6: Success - return created deck with 201 Created
    const successResponse: DeckDTO = createdDeck;

    return new Response(JSON.stringify(successResponse), {
      status: 201 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        Location: `/api/v1/decks/${createdDeck.id}`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("[POST /api/v1/decks] Internal server error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
