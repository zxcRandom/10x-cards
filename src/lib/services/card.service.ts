import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CardDTO,
  CreateCardCommand,
  DbCard,
  ErrorCode,
} from "../../types";

/**
 * SM-2 Algorithm Default Values
 * Used when creating new cards
 */
const SM2_DEFAULTS = {
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 0,
} as const;

/**
 * Maps database card row (snake_case) to CardDTO (camelCase)
 *
 * @param dbCard - Card row from database
 * @returns CardDTO with camelCase field names
 */
function mapCardToDTO(dbCard: DbCard): CardDTO {
  return {
    id: dbCard.id,
    deckId: dbCard.deck_id,
    question: dbCard.question,
    answer: dbCard.answer,
    easeFactor: dbCard.ease_factor,
    intervalDays: dbCard.interval_days,
    repetitions: dbCard.repetitions,
    nextReviewDate: dbCard.next_review_date,
    createdAt: dbCard.created_at,
    updatedAt: dbCard.updated_at,
  };
}

/**
 * CardService - Business logic for card management
 *
 * Handles CRUD operations for flashcards including SM-2 spaced repetition data
 */
export const CardService = {
  /**
   * Creates a new card in a deck with SM-2 default values
   *
   * @param supabase - Supabase client instance
   * @param deckId - UUID of the deck to add the card to
   * @param command - Card creation data (CreateCardCommand)
   * @returns Promise<CardDTO | { error: ErrorCode }>
   *
   * @example
   * const result = await CardService.createCard(
   *   supabase,
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   { question: "What is closure?", answer: "A function that..." }
   * );
   *
   * if ("error" in result) {
   *   // Handle error
   * } else {
   *   // Use result as CardDTO
   * }
   */
  async createCard(
    supabase: SupabaseClient,
    deckId: string,
    command: CreateCardCommand
  ): Promise<CardDTO | { error: ErrorCode }> {
    try {
      // Get current timestamp for nextReviewDate
      const now = new Date().toISOString();

      // Insert card with SM-2 defaults
      const { data, error } = await supabase
        .from("cards")
        .insert({
          deck_id: deckId,
          question: command.question.trim(),
          answer: command.answer.trim(),
          ease_factor: SM2_DEFAULTS.easeFactor,
          interval_days: SM2_DEFAULTS.intervalDays,
          repetitions: SM2_DEFAULTS.repetitions,
          next_review_date: now,
        })
        .select()
        .single();

      if (error) {
        console.error("[CardService.createCard] Database error:", {
          deckId,
          error: error.message,
          code: error.code,
        });

        // Check for foreign key constraint violation (deck doesn't exist)
        if (error.code === "23503") {
          return { error: "DECK_NOT_FOUND" as ErrorCode };
        }

        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      if (!data) {
        console.error("[CardService.createCard] No data returned after insert:", {
          deckId,
          command,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      return mapCardToDTO(data);
    } catch (error) {
      console.error("[CardService.createCard] Unexpected error:", {
        deckId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error: "INTERNAL_SERVER_ERROR" as ErrorCode };
    }
  },

  /**
   * Retrieves a card by ID
   *
   * @param supabase - Supabase client instance
   * @param cardId - UUID of the card to retrieve
   * @param userId - UUID of the authenticated user (for RLS)
   * @returns Promise<CardDTO | null>
   *
   * @example
   * const card = await CardService.getCardById(
   *   supabase,
   *   "660e8400-e29b-41d4-a716-446655440001",
   *   "bee8997e-9e30-4a76-b675-15917059c46a"
   * );
   */
  async getCardById(
    supabase: SupabaseClient,
    cardId: string,
    userId: string
  ): Promise<CardDTO | null> {
    try {
      const { data, error } = await supabase
        .from("cards")
        .select(
          `
          *,
          decks!inner (user_id)
        `
        )
        .eq("id", cardId)
        .eq("decks.user_id", userId)
        .single();

      if (error) {
        console.error("[CardService.getCardById] Database error:", {
          cardId,
          userId,
          error: error.message,
        });
        return null;
      }

      if (!data) {
        return null;
      }

      return mapCardToDTO(data);
    } catch (error) {
      console.error("[CardService.getCardById] Unexpected error:", {
        cardId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },

  /**
   * Verifies if a deck exists and belongs to the user
   *
   * @param supabase - Supabase client instance
   * @param deckId - UUID of the deck to verify
   * @param userId - UUID of the authenticated user
   * @returns Promise<{ exists: boolean; owned: boolean }>
   *
   * @example
   * const { exists, owned } = await CardService.verifyDeckOwnership(
   *   supabase,
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   "bee8997e-9e30-4a76-b675-15917059c46a"
   * );
   *
   * if (!exists) {
   *   // Deck not found (404)
   * } else if (!owned) {
   *   // Deck exists but doesn't belong to user (403)
   * }
   */
  async verifyDeckOwnership(
    supabase: SupabaseClient,
    deckId: string,
    userId: string
  ): Promise<{ exists: boolean; owned: boolean }> {
    try {
      const { data, error } = await supabase
        .from("decks")
        .select("id, user_id")
        .eq("id", deckId)
        .single();

      if (error || !data) {
        return { exists: false, owned: false };
      }

      return {
        exists: true,
        owned: data.user_id === userId,
      };
    } catch (error) {
      console.error("[CardService.verifyDeckOwnership] Unexpected error:", {
        deckId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { exists: false, owned: false };
    }
  },

  /**
   * Updates a card's question and/or answer
   * SM-2 fields (easeFactor, intervalDays, repetitions, nextReviewDate) cannot be updated
   * and are managed exclusively by the review endpoint
   *
   * @param supabase - Supabase client instance
   * @param cardId - UUID of the card to update
   * @param userId - UUID of the authenticated user (for ownership verification)
   * @param command - Update data (UpdateCardCommand)
   * @returns Promise<CardDTO | { error: ErrorCode }>
   *
   * @example
   * const result = await CardService.updateCard(
   *   supabase,
   *   "660e8400-e29b-41d4-a716-446655440001",
   *   "bee8997e-9e30-4a76-b675-15917059c46a",
   *   { question: "Updated question?" }
   * );
   *
   * if ("error" in result) {
   *   // Handle error
   * } else {
   *   // Use result as CardDTO
   * }
   */
  async updateCard(
    supabase: SupabaseClient,
    cardId: string,
    userId: string,
    command: { question?: string; answer?: string }
  ): Promise<CardDTO | { error: ErrorCode }> {
    try {
      // Verify card ownership via JOIN with decks
      const { data: cardCheck, error: checkError } = await supabase
        .from("cards")
        .select(
          `
          id,
          decks!inner (user_id)
        `
        )
        .eq("id", cardId)
        .eq("decks.user_id", userId)
        .single();

      if (checkError || !cardCheck) {
        console.error("[CardService.updateCard] Card not found or access denied:", {
          cardId,
          userId,
          error: checkError?.message,
        });
        return { error: "CARD_NOT_FOUND" as ErrorCode };
      }

      // Prepare update data (only question and answer, ignore SM-2 fields)
      const updateData: any = {};

      if (command.question !== undefined) {
        updateData.question = command.question.trim();
      }
      if (command.answer !== undefined) {
        updateData.answer = command.answer.trim();
      }

      // Update card in database
      const { data, error } = await supabase
        .from("cards")
        .update(updateData)
        .eq("id", cardId)
        .select()
        .single();

      if (error) {
        console.error("[CardService.updateCard] Database error:", {
          cardId,
          userId,
          error: error.message,
          code: error.code,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      if (!data) {
        console.error("[CardService.updateCard] No data returned after update:", {
          cardId,
          userId,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      return mapCardToDTO(data);
    } catch (error) {
      console.error("[CardService.updateCard] Unexpected error:", {
        cardId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error: "INTERNAL_SERVER_ERROR" as ErrorCode };
    }
  },
};
