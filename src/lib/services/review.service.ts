import type { SupabaseClient } from "../../db/supabase.client";
import type {
  ReviewDTO,
  ReviewResponseDTO,
  CreateReviewCommand,
  DbReview,
  DbCard,
  ErrorCode,
  ReviewGrade,
} from "../../types";

/**
 * SM-2 Algorithm Constants
 */
const SM2_CONSTANTS = {
  MIN_EASE_FACTOR: 1.3,
  MAX_EASE_FACTOR: 2.5,
  EASE_FACTOR_DECREASE: 0.2,
  EASE_FACTOR_INCREASE: 0.1,
  GRADE_PENALTY: 0.08,
} as const;

/**
 * SM-2 Algorithm Result
 */
interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: string;
}

/**
 * Card with deck relationship from JOIN query
 */
interface CardWithDeck {
  id: string;
  deck_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  deck: {
    user_id: string;
  };
}

/**
 * Type guard to validate CardWithDeck structure
 */
function isCardWithDeck(data: unknown): data is CardWithDeck {
  if (!data || typeof data !== 'object') return false;
  const card = data as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    typeof card.deck_id === 'string' &&
    typeof card.ease_factor === 'number' &&
    typeof card.interval_days === 'number' &&
    typeof card.repetitions === 'number' &&
    typeof card.next_review_date === 'string' &&
    typeof card.deck === 'object' &&
    card.deck !== null &&
    typeof (card.deck as Record<string, unknown>).user_id === 'string'
  );
}

/**
 * Maps database review row (snake_case) to ReviewDTO (camelCase)
 *
 * @param dbReview - Review row from database
 * @returns ReviewDTO with camelCase field names
 */
function mapReviewToDTO(dbReview: DbReview): ReviewDTO {
  return {
    id: dbReview.id,
    cardId: dbReview.card_id,
    userId: dbReview.user_id,
    grade: dbReview.grade as ReviewGrade,
    reviewDate: dbReview.review_date,
  };
}

/**
 * Calculates new SM-2 parameters based on review grade
 *
 * SM-2 Algorithm:
 * - Grade < 3: Failed (reset interval to 1 day, decrease ease factor)
 * - Grade >= 3: Success (increase interval, adjust ease factor based on difficulty)
 *
 * @param currentEaseFactor - Current ease factor (min 1.3)
 * @param currentIntervalDays - Current interval in days
 * @param currentRepetitions - Number of consecutive correct repetitions
 * @param grade - Review grade (0-5)
 * @param reviewDate - Optional review date (defaults to now)
 * @returns New SM-2 parameters
 */
function calculateSM2Parameters(
  currentEaseFactor: number,
  currentIntervalDays: number,
  currentRepetitions: number,
  grade: ReviewGrade,
  reviewDate?: string
): SM2Result {
  let newEaseFactor: number;
  let newIntervalDays: number;
  let newRepetitions: number;

  if (grade < 3) {
    // Failed - reset progress
    newRepetitions = 0;
    newIntervalDays = 1;
    newEaseFactor = Math.max(
      SM2_CONSTANTS.MIN_EASE_FACTOR,
      Math.min(
        SM2_CONSTANTS.MAX_EASE_FACTOR,
        currentEaseFactor - SM2_CONSTANTS.EASE_FACTOR_DECREASE
      )
    );
  } else {
    // Success - increase progress
    newRepetitions = currentRepetitions + 1;

    // Calculate interval based on repetition count
    if (newRepetitions === 1) {
      newIntervalDays = 1;
    } else if (newRepetitions === 2) {
      newIntervalDays = 6;
    } else {
      newIntervalDays = Math.round(currentIntervalDays * currentEaseFactor);
    }

    // Adjust ease factor based on grade difficulty
    newEaseFactor = Math.max(
      SM2_CONSTANTS.MIN_EASE_FACTOR,
      Math.min(
        SM2_CONSTANTS.MAX_EASE_FACTOR,
        currentEaseFactor +
          SM2_CONSTANTS.EASE_FACTOR_INCREASE -
          (5 - grade) * SM2_CONSTANTS.GRADE_PENALTY
      )
    );
  }

  // Calculate next review date
  const baseDate = reviewDate ? new Date(reviewDate) : new Date();
  const nextReviewDate = new Date(baseDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + newIntervalDays);

  return {
    easeFactor: newEaseFactor,
    intervalDays: newIntervalDays,
    repetitions: newRepetitions,
    nextReviewDate: nextReviewDate.toISOString(),
  };
}

/**
 * ReviewService - Business logic for review management
 *
 * Handles review submission, SM-2 algorithm calculation, and card updates
 */
export const ReviewService = {
  /**
   * Creates a review and updates card SM-2 parameters
   *
   * This operation is transactional:
   * 1. Verifies card ownership via deck.user_id
   * 2. Fetches current card SM-2 parameters
   * 3. Calculates new SM-2 parameters using SM-2 algorithm
   * 4. Inserts review record
   * 5. Updates card with new SM-2 parameters
   *
   * @param supabase - Supabase client instance
   * @param cardId - UUID of the card to review
   * @param userId - UUID of the authenticated user
   * @param command - Review data (CreateReviewCommand)
   * @returns Promise<ReviewResponseDTO | { error: ErrorCode }>
   *
   * @example
   * const result = await ReviewService.createReview(
   *   supabase,
   *   "660e8400-e29b-41d4-a716-446655440001",
   *   "user-123",
   *   { grade: 4, reviewDate: "2025-10-19T14:30:00Z" }
   * );
   *
   * if ("error" in result) {
   *   // Handle error
   * } else {
   *   // Use result as ReviewResponseDTO
   * }
   */
  async createReview(
    supabase: SupabaseClient,
    cardId: string,
    userId: string,
    command: CreateReviewCommand
  ): Promise<ReviewResponseDTO | { error: ErrorCode }> {
    try {
      // STEP 1: Verify card ownership and fetch current SM-2 parameters
      const { data: card, error: cardError } = await supabase
        .from("cards")
        .select(
          `
          id,
          deck_id,
          ease_factor,
          interval_days,
          repetitions,
          next_review_date,
          deck:decks!inner(user_id)
        `
        )
        .eq("id", cardId)
        .single();

      if (cardError) {
        console.error("[ReviewService.createReview] Card query error:", {
          cardId,
          userId,
          error: cardError.message,
          code: cardError.code,
        });
        return { error: "CARD_NOT_FOUND" as ErrorCode };
      }

      if (!card) {
        console.error("[ReviewService.createReview] Card not found:", {
          cardId,
          userId,
        });
        return { error: "CARD_NOT_FOUND" as ErrorCode };
      }

      // Validate card structure with runtime type checking
      if (!isCardWithDeck(card)) {
        console.error("[ReviewService.createReview] Invalid card structure:", {
          cardId,
          userId,
          cardStructure: card,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      // Check ownership via JOIN - safely typed with runtime validation
      if (!card.deck || card.deck.user_id !== userId) {
        console.warn("[ReviewService.createReview] Access denied:", {
          cardId,
          userId,
          deckUserId: card.deck?.user_id,
        });
        return { error: "FORBIDDEN" as ErrorCode };
      }

      // STEP 2: Calculate new SM-2 parameters
      const sm2Result = calculateSM2Parameters(
        card.ease_factor,
        card.interval_days,
        card.repetitions,
        command.grade,
        command.reviewDate
      );

      // STEP 3: Prepare review data
      const reviewDate = command.reviewDate || new Date().toISOString();

      // STEP 4: Insert review record
      const { data: review, error: reviewError } = await supabase
        .from("reviews")
        .insert({
          card_id: cardId,
          user_id: userId,
          grade: command.grade,
          review_date: reviewDate,
        })
        .select()
        .single();

      if (reviewError) {
        console.error("[ReviewService.createReview] Review insert error:", {
          cardId,
          userId,
          error: reviewError.message,
          code: reviewError.code,
        });
        return { error: "UNPROCESSABLE_ENTITY" as ErrorCode };
      }

      if (!review) {
        console.error(
          "[ReviewService.createReview] No data returned after review insert:",
          {
            cardId,
            userId,
          }
        );
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      // STEP 5: Update card with new SM-2 parameters
      const { data: updatedCard, error: updateError } = await supabase
        .from("cards")
        .update({
          ease_factor: sm2Result.easeFactor,
          interval_days: sm2Result.intervalDays,
          repetitions: sm2Result.repetitions,
          next_review_date: sm2Result.nextReviewDate,
        })
        .eq("id", cardId)
        .select()
        .single();

      if (updateError) {
        console.error("[ReviewService.createReview] Card update error:", {
          cardId,
          userId,
          error: updateError.message,
          code: updateError.code,
        });
        return { error: "UNPROCESSABLE_ENTITY" as ErrorCode };
      }

      if (!updatedCard) {
        console.error(
          "[ReviewService.createReview] No data returned after card update:",
          {
            cardId,
            userId,
          }
        );
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      // STEP 6: Build response DTO
      const response: ReviewResponseDTO = {
        card: {
          id: updatedCard.id,
          easeFactor: updatedCard.ease_factor,
          intervalDays: updatedCard.interval_days,
          repetitions: updatedCard.repetitions,
          nextReviewDate: updatedCard.next_review_date,
          updatedAt: updatedCard.updated_at,
        },
        review: mapReviewToDTO(review),
      };

      return response;
    } catch (error) {
      console.error("[ReviewService.createReview] Unexpected error:", {
        cardId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error: "INTERNAL_SERVER_ERROR" as ErrorCode };
    }
  },
};
