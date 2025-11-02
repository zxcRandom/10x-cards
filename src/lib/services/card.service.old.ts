import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CardDTO,
  CardsListDTO,
  CreateCardCommand,
  DbCard,
  ErrorCode,
} from "../../types";
import { CardRepository } from "../repositories/card.repository";
import type { CardListOptions } from "../repositories/card.repository";
import { SM2Parameters } from "../domain/sm2-parameters";
import { Result } from "../utils/result";

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
 * CardService - Business Logic Layer for Card Management
 *
 * Handles business rules and orchestrates card operations using CardRepository.
 * Focuses on business logic such as:
 * - Authorization checks (deck ownership)
 * - Business rule enforcement (SM-2 defaults for new cards)
 * - Error mapping from database to domain errors
 * - Data transformation (DbCard -> CardDTO)
 * 
 * Following Service Layer principles:
 * - Business logic only
 * - Delegates data access to Repository
 * - Returns Result<T, E> for type-safe error handling
 */
export class CardService {
  private repository: CardRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new CardRepository(supabase);
  }

  /**
   * Creates a new card in a deck with SM-2 default values
   *
   * @param deckId - UUID of the deck to add the card to
   * @param command - Card creation data (CreateCardCommand)
   * @returns Result with CardDTO or ErrorCode
   *
   * @example
   * const service = new CardService(supabase);
   * const result = await service.createCard(
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   { question: "What is closure?", answer: "A function that..." }
   * );
   *
   * if (result.isOk()) {
   *   console.log("Created card:", result.value);
   * } else {
   *   console.error("Error:", result.error);
   * }
   */
  async createCard(
    deckId: string,
    command: CreateCardCommand
  ): Promise<Result<CardDTO, ErrorCode>> {
    try {
      // Business Rule: New cards get default SM-2 parameters
      const sm2Params = SM2Parameters.createDefaults();
      const now = new Date().toISOString();

      const dbCard = await this.repository.create(
        deckId,
        command,
        sm2Params,
        now
      );

      return Result.ok(mapCardToDTO(dbCard));
    } catch (error: any) {
      console.error("[CardService.createCard] Error:", {
        deckId,
        error: error.message,
        code: error.code,
      });

      // Map database errors to domain errors
      if (error.code === "23503") {
        // Foreign key constraint violation
        return Result.err("DECK_NOT_FOUND" as ErrorCode);
      }

      if (error.code) {
        return Result.err("DATABASE_ERROR" as ErrorCode);
      }

      return Result.err("INTERNAL_SERVER_ERROR" as ErrorCode);
    }
  }

  /**
   * Creates multiple cards in a deck (batch operation)
   * Used primarily for AI-generated card creation
   *
   * @param supabase - Supabase client instance
   * @param deckId - UUID of the deck to add cards to
   * @param userId - UUID of the authenticated user (for ownership check)
   * @param cards - Array of card creation data
   * @returns Promise<CardDTO[] | { error: ErrorCode }>
   *
   * @example
   * const result = await CardService.createCardsBatch(
   *   supabase,
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   "user-123",
   *   [
   *     { question: "Q1", answer: "A1" },
   *     { question: "Q2", answer: "A2" }
   *   ]
   * );
   */
  async createCardsBatch(
    supabase: SupabaseClient,
    deckId: string,
    userId: string,
    cards: CreateCardCommand[]
  ): Promise<CardDTO[] | { error: ErrorCode }> {
    try {
      // Verify deck ownership first
      const { exists, owned } = await CardService.verifyDeckOwnership(
        supabase,
        deckId,
        userId
      );

      if (!exists) {
        return { error: "DECK_NOT_FOUND" as ErrorCode };
      }

      if (!owned) {
        return { error: "FORBIDDEN" as ErrorCode };
      }

      // Prepare batch insert data
      const now = new Date().toISOString();
      const cardInserts = cards.map((card) => ({
        deck_id: deckId,
        question: card.question.trim(),
        answer: card.answer.trim(),
        ease_factor: SM2_DEFAULTS.easeFactor,
        interval_days: SM2_DEFAULTS.intervalDays,
        repetitions: SM2_DEFAULTS.repetitions,
        next_review_date: now,
      }));

      // Insert all cards in one query
      const { data, error } = await supabase
        .from("cards")
        .insert(cardInserts)
        .select();

      if (error) {
        console.error("[CardService.createCardsBatch] Database error:", {
          deckId,
          userId,
          cardsCount: cards.length,
          error: error.message,
          code: error.code,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      if (!data || data.length === 0) {
        console.error("[CardService.createCardsBatch] No data returned:", {
          deckId,
          userId,
          cardsCount: cards.length,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      console.log(`[CardService.createCardsBatch] Created ${data.length} cards for deck ${deckId}`);
      return data.map(mapCardToDTO);
    } catch (error) {
      console.error("[CardService.createCardsBatch] Unexpected error:", {
        deckId,
        userId,
        cardsCount: cards.length,
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

  /**
   * Lists all cards in a deck with pagination, sorting, and filtering
   *
   * @param supabase - Supabase client instance
   * @param deckId - UUID of the deck
   * @param userId - UUID of the authenticated user (for ownership verification)
   * @param options - Query options (pagination, sorting, search)
   * @returns Promise<CardsListDTO | { error: ErrorCode }>
   *
   * @example
   * const result = await CardService.listCards(
   *   supabase,
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   "bee8997e-9e30-4a76-b675-15917059c46a",
   *   { limit: 20, offset: 0, sort: 'createdAt', order: 'desc', q: 'JavaScript' }
   * );
   */
  async listCards(
    supabase: SupabaseClient,
    deckId: string,
    userId: string,
    options: {
      limit: number;
      offset: number;
      sort:
        | "createdAt"
        | "updatedAt"
        | "nextReviewDate"
        | "easeFactor"
        | "intervalDays"
        | "repetitions"
        | "question"
        | "answer";
      order: "asc" | "desc";
      q?: string;
    }
  ): Promise<CardsListDTO | { error: ErrorCode }> {
    try {
      // Verify deck ownership
      const { exists, owned } = await this.verifyDeckOwnership(
        supabase,
        deckId,
        userId
      );

      if (!exists) {
        return { error: "DECK_NOT_FOUND" as ErrorCode };
      }

      if (!owned) {
        return { error: "FORBIDDEN" as ErrorCode };
      }

      // Map sort field to database column
      const sortFieldMap: Record<string, string> = {
        createdAt: "created_at",
        updatedAt: "updated_at",
        nextReviewDate: "next_review_date",
        easeFactor: "ease_factor",
        intervalDays: "interval_days",
        repetitions: "repetitions",
        question: "question",
        answer: "answer",
      };

      const sortField = sortFieldMap[options.sort];

      // Build query for cards
      let query = supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId);

      // Add search filter if provided
      if (options.q) {
        query = query.ilike("question", `%${options.q}%`);
      }

      // Add sorting
      query = query.order(sortField, { ascending: options.order === "asc" });

      // Add pagination
      query = query.range(
        options.offset,
        options.offset + options.limit - 1
      );

      // Execute query
      const { data, error } = await query;

      if (error) {
        console.error("[CardService.listCards] Database error:", {
          deckId,
          userId,
          error: error.message,
          code: error.code,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      // Get total count
      let countQuery = supabase
        .from("cards")
        .select("*", { count: "exact", head: true })
        .eq("deck_id", deckId);

      if (options.q) {
        countQuery = countQuery.ilike("question", `%${options.q}%`);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error("[CardService.listCards] Count query error:", {
          deckId,
          userId,
          error: countError.message,
        });
        return { error: "DATABASE_ERROR" as ErrorCode };
      }

      // Map to DTOs
      const items = (data || []).map(mapCardToDTO);

      return {
        items,
        total: count || 0,
        limit: options.limit,
        offset: options.offset,
      };
    } catch (error) {
      console.error("[CardService.listCards] Unexpected error:", {
        deckId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { error: "INTERNAL_SERVER_ERROR" as ErrorCode };
    }
  },
};
