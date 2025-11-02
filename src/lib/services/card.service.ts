/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "../../db/supabase.client";
import type { CardDTO, CardsListDTO, CreateCardCommand, DbCard, ErrorCode } from "../../types";
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
  async createCard(deckId: string, command: CreateCardCommand): Promise<Result<CardDTO, ErrorCode>> {
    try {
      // Business Rule: New cards get default SM-2 parameters
      const sm2Params = SM2Parameters.createDefaults();
      const now = new Date().toISOString();

      const dbCard = await this.repository.create(deckId, command, sm2Params, now);

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
   * @param deckId - UUID of the deck to add cards to
   * @param userId - UUID of the authenticated user (for ownership check)
   * @param cards - Array of card creation data
   * @returns Result with array of CardDTOs or ErrorCode
   *
   * @example
   * const service = new CardService(supabase);
   * const result = await service.createCardsBatch(
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   "user-123",
   *   [
   *     { question: "Q1", answer: "A1" },
   *     { question: "Q2", answer: "A2" }
   *   ]
   * );
   */
  async createCardsBatch(
    deckId: string,
    userId: string,
    cards: CreateCardCommand[]
  ): Promise<Result<CardDTO[], ErrorCode>> {
    try {
      // Business Rule: Verify deck ownership before batch creation
      const ownership = await this.repository.verifyDeckOwnership(deckId, userId);

      if (!ownership.exists) {
        return Result.err("DECK_NOT_FOUND" as ErrorCode);
      }

      if (!ownership.owned) {
        return Result.err("FORBIDDEN" as ErrorCode);
      }

      // Business Rule: All new cards get default SM-2 parameters
      const sm2Params = SM2Parameters.createDefaults();
      const now = new Date().toISOString();

      const dbCards = await this.repository.createBatch(deckId, cards, sm2Params, now);

      console.log(`[CardService.createCardsBatch] Created ${dbCards.length} cards for deck ${deckId}`);
      return Result.ok(dbCards.map(mapCardToDTO));
    } catch (error: any) {
      console.error("[CardService.createCardsBatch] Error:", {
        deckId,
        userId,
        cardsCount: cards.length,
        error: error.message,
        code: error.code,
      });

      if (error.code) {
        return Result.err("DATABASE_ERROR" as ErrorCode);
      }

      return Result.err("INTERNAL_SERVER_ERROR" as ErrorCode);
    }
  }

  /**
   * Retrieves a card by ID
   *
   * @param cardId - UUID of the card to retrieve
   * @param userId - UUID of the authenticated user (for ownership check via deck)
   * @returns CardDTO or null if not found/access denied
   *
   * @example
   * const service = new CardService(supabase);
   * const card = await service.getCardById(
   *   "660e8400-e29b-41d4-a716-446655440001",
   *   "bee8997e-9e30-4a76-b675-15917059c46a"
   * );
   */
  async getCardById(cardId: string, userId: string): Promise<CardDTO | null> {
    try {
      const dbCard = await this.repository.findById(cardId, userId);

      if (!dbCard) {
        return null;
      }

      return mapCardToDTO(dbCard);
    } catch (error: any) {
      console.error("[CardService.getCardById] Error:", {
        cardId,
        userId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Verifies if a deck exists and belongs to the user
   *
   * @param deckId - UUID of the deck to verify
   * @param userId - UUID of the authenticated user
   * @returns Object with exists and owned flags
   *
   * @example
   * const service = new CardService(supabase);
   * const { exists, owned } = await service.verifyDeckOwnership(
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
  async verifyDeckOwnership(deckId: string, userId: string): Promise<{ exists: boolean; owned: boolean }> {
    try {
      return await this.repository.verifyDeckOwnership(deckId, userId);
    } catch (error: any) {
      console.error("[CardService.verifyDeckOwnership] Error:", {
        deckId,
        userId,
        error: error.message,
      });
      return { exists: false, owned: false };
    }
  }

  /**
   * Updates a card's question and/or answer
   * SM-2 fields (easeFactor, intervalDays, repetitions, nextReviewDate) cannot be updated
   * and are managed exclusively by the review endpoint
   *
   * @param cardId - UUID of the card to update
   * @param userId - UUID of the authenticated user (for ownership verification)
   * @param command - Update data (question and/or answer)
   * @returns Result with updated CardDTO or ErrorCode
   *
   * @example
   * const service = new CardService(supabase);
   * const result = await service.updateCard(
   *   "660e8400-e29b-41d4-a716-446655440001",
   *   "bee8997e-9e30-4a76-b675-15917059c46a",
   *   { question: "Updated question?" }
   * );
   *
   * if (result.isOk()) {
   *   console.log("Updated card:", result.value);
   * } else {
   *   console.error("Error:", result.error);
   * }
   */
  async updateCard(
    cardId: string,
    userId: string,
    command: { question?: string; answer?: string }
  ): Promise<Result<CardDTO, ErrorCode>> {
    try {
      // Business Rule: Verify ownership before update
      const hasAccess = await this.repository.verifyCardOwnership(cardId, userId);

      if (!hasAccess) {
        console.error("[CardService.updateCard] Card not found or access denied:", {
          cardId,
          userId,
        });
        return Result.err("CARD_NOT_FOUND" as ErrorCode);
      }

      // Update card via repository
      const dbCard = await this.repository.update(cardId, command);

      return Result.ok(mapCardToDTO(dbCard));
    } catch (error: any) {
      console.error("[CardService.updateCard] Error:", {
        cardId,
        userId,
        error: error.message,
        code: error.code,
      });

      if (error.code) {
        return Result.err("DATABASE_ERROR" as ErrorCode);
      }

      return Result.err("INTERNAL_SERVER_ERROR" as ErrorCode);
    }
  }

  /**
   * Lists all cards in a deck with pagination, sorting, and filtering
   *
   * @param deckId - UUID of the deck
   * @param userId - UUID of the authenticated user (for ownership verification)
   * @param options - Query options (pagination, sorting, search)
   * @returns Result with CardsListDTO or ErrorCode
   *
   * @example
   * const service = new CardService(supabase);
   * const result = await service.listCards(
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   "bee8997e-9e30-4a76-b675-15917059c46a",
   *   { limit: 20, offset: 0, sort: 'createdAt', order: 'desc', searchTerm: 'JavaScript' }
   * );
   */
  async listCards(deckId: string, userId: string, options: CardListOptions): Promise<Result<CardsListDTO, ErrorCode>> {
    try {
      // Business Rule: Verify deck ownership before listing cards
      const ownership = await this.repository.verifyDeckOwnership(deckId, userId);

      if (!ownership.exists) {
        return Result.err("DECK_NOT_FOUND" as ErrorCode);
      }

      if (!ownership.owned) {
        return Result.err("FORBIDDEN" as ErrorCode);
      }

      // Fetch cards from repository
      const result = await this.repository.list(deckId, options);

      // Transform to DTOs
      const items = result.items.map(mapCardToDTO);

      return Result.ok({
        items,
        total: result.total,
        limit: options.limit,
        offset: options.offset,
      });
    } catch (error: any) {
      console.error("[CardService.listCards] Error:", {
        deckId,
        userId,
        error: error.message,
        code: error.code,
      });

      if (error.code) {
        return Result.err("DATABASE_ERROR" as ErrorCode);
      }

      return Result.err("INTERNAL_SERVER_ERROR" as ErrorCode);
    }
  }
}
