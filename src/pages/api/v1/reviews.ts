import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { ReviewsListDTO, ErrorResponse, ReviewGrade } from '../../../types';

export const prerender = false;

// Validation schema for query parameters
const reviewsQuerySchema = z.object({
	cardId: z.string().uuid('Invalid card ID format').optional(),
	deckId: z.string().uuid('Invalid deck ID format').optional(),
	from: z.string().datetime('Invalid from date format').optional(),
	to: z.string().datetime('Invalid to date format').optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
	sort: z.enum(['reviewDate']).default('reviewDate'),
	order: z.enum(['asc', 'desc']).default('desc'),
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
						code: 'UNAUTHORIZED',
						message: 'Authentication required',
					},
				} satisfies ErrorResponse),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// STEP 2: Validate and parse query parameters
		const queryParams = Object.fromEntries(url.searchParams.entries());
		const validated = reviewsQuerySchema.parse(queryParams);

	// STEP 3: Build database query with filters
	let query = locals.supabase
		.from('reviews')
		.select('*')
		.eq('user_id', user.id);

	// Cache cardIds for reuse in count query (avoid duplicate DB call)
	let cardIds: string[] | null = null;

	// Apply optional filters
	if (validated.cardId) {
			query = query.eq('card_id', validated.cardId);
		}

		// deckId filter requires JOIN through cards table
		if (validated.deckId) {
			// Need to get card IDs for this deck first
			const { data: cardsInDeck, error: cardsError } = await locals.supabase
				.from('cards')
				.select('id')
				.eq('deck_id', validated.deckId);

			if (cardsError) {
				console.error('Failed to fetch cards for deck:', cardsError);
				return new Response(
					JSON.stringify({
						error: {
							code: 'INTERNAL_SERVER_ERROR',
							message: 'Failed to retrieve reviews',
							details: 'Failed to fetch deck cards',
						},
					} satisfies ErrorResponse),
					{ status: 500, headers: { 'Content-Type': 'application/json' } }
				);
			}

			// Filter reviews by card IDs in this deck (store for reuse)
			cardIds = (cardsInDeck || []).map((card) => card.id);
			if (cardIds.length > 0) {
				query = query.in('card_id', cardIds);
			} else {
				// No cards in deck, return empty result
				const emptyResponse: ReviewsListDTO = {
					items: [],
					total: 0,
					limit: validated.limit,
					offset: validated.offset,
				};
				return new Response(JSON.stringify(emptyResponse), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		// Date range filters
		if (validated.from) {
			query = query.gte('review_date', validated.from);
		}
		if (validated.to) {
			query = query.lte('review_date', validated.to);
		}

		// Apply sorting
		query = query.order('review_date', { ascending: validated.order === 'asc' });

		// Apply pagination
		query = query.range(validated.offset, validated.offset + validated.limit - 1);

		// STEP 4: Execute Query
		const { data: reviews, error: reviewsError } = await query;

		if (reviewsError) {
			console.error('Failed to fetch reviews:', reviewsError);
			return new Response(
				JSON.stringify({
					error: {
						code: 'INTERNAL_SERVER_ERROR',
						message: 'Failed to retrieve reviews',
						details: 'Database query failed',
					},
				} satisfies ErrorResponse),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// STEP 5: Get total count for pagination
		let countQuery = locals.supabase
			.from('reviews')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', user.id);

	// Apply same filters to count query
	if (validated.cardId) {
		countQuery = countQuery.eq('card_id', validated.cardId);
	}
	if (validated.deckId && cardIds) {
		// Reuse cached cardIds from earlier query (avoid duplicate DB call)
		if (cardIds.length > 0) {
			countQuery = countQuery.in('card_id', cardIds);
		}
	}
	if (validated.from) {
		countQuery = countQuery.gte('review_date', validated.from);
	}
	if (validated.to) {
		countQuery = countQuery.lte('review_date', validated.to);
	}

	const { count, error: countError } = await countQuery;

		if (countError) {
			console.error('Failed to count reviews:', countError);
			return new Response(
				JSON.stringify({
					error: {
						code: 'INTERNAL_SERVER_ERROR',
						message: 'Failed to retrieve reviews',
						details: 'Count query failed',
					},
				} satisfies ErrorResponse),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
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
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('GET /api/v1/reviews failed:', error);

		if (error instanceof z.ZodError) {
			return new Response(
				JSON.stringify({
					error: {
						code: 'BAD_REQUEST',
						message: 'Invalid query parameters',
						details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
					},
				} satisfies ErrorResponse),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		return new Response(
			JSON.stringify({
				error: {
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to retrieve reviews',
				},
			} satisfies ErrorResponse),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
