import type { APIRoute } from "astro";
import { z } from "zod";
import type { ReviewsListDTO, ErrorResponse, ReviewGrade } from "../../../types";

export const prerender = false;

// Validation schema for query parameters
const reviewsQuerySchema = z.object({
  cardId: z.string().uuid("Invalid card ID format").optional(),
  deckId: z.string().uuid("Invalid deck ID format").optional(),
  from: z.string().datetime("Invalid from date format").optional(),
  to: z.string().datetime("Invalid to date format").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["reviewDate"]).default("reviewDate"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/v1/reviews
 * List reviews for the authenticated user with filtering and pagination
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // STEP 1: Authentication Check
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        } satisfies ErrorResponse),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 2: Validate and parse query parameters
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const validated = reviewsQuerySchema.parse(queryParams);

    // STEP 3: Build database query with filters
    let selectQuery = "*";
    if (validated.deckId) {
      // Use !inner join to filter reviews by cards belonging to the specified deck
      selectQuery = "*, cards!inner(deck_id)";
    }

    // Optimize: Get count in the same query
    let query = locals.supabase.from("reviews").select(selectQuery, { count: "exact" }).eq("user_id", user.id);

    // Apply optional filters
    if (validated.cardId) {
      query = query.eq("card_id", validated.cardId);
    }

    // deckId filter via JOIN
    if (validated.deckId) {
      // SECURITY CHECK: Ensure deck belongs to user before fetching reviews
      // This adds defense-in-depth on top of RLS
      const { data: deck, error: deckError } = await locals.supabase
        .from("decks")
        .select("id")
        .eq("id", validated.deckId)
        .eq("user_id", user.id)
        .single();

      if (deckError || !deck) {
        // Deck not found or doesn't belong to user
        // Return empty result instead of error to avoid leaking existence
        const emptyResponse: ReviewsListDTO = {
          items: [],
          total: 0,
          limit: validated.limit,
          offset: validated.offset,
        };
        return new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Add filter for the joined table
      query = query.eq("cards.deck_id", validated.deckId);
    }

    // Date range filters
    if (validated.from) {
      query = query.gte("review_date", validated.from);
    }
    if (validated.to) {
      query = query.lte("review_date", validated.to);
    }

    // Apply sorting
    query = query.order("review_date", { ascending: validated.order === "asc" });

    // Apply pagination
    query = query.range(validated.offset, validated.offset + validated.limit - 1);

    // STEP 4: Execute Query
    const { data: reviews, count, error: reviewsError } = await query;

    if (reviewsError) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch reviews:", reviewsError);
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve reviews",
            details: "Database query failed",
          },
        } satisfies ErrorResponse),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 6: Map to DTOs
    const reviewDTOs = (reviews || []).map((review) => ({
      id: review.id,
      cardId: review.card_id,
      userId: review.user_id,
      grade: review.grade as ReviewGrade,
      reviewDate: review.review_date,
    }));

    const response: ReviewsListDTO = {
      items: reviewDTOs,
      total: count || 0,
      limit: validated.limit,
      offset: validated.offset,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("GET /api/v1/reviews failed:", error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query parameters",
            details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
          },
        } satisfies ErrorResponse),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve reviews",
        },
      } satisfies ErrorResponse),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
