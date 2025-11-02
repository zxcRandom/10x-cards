import type { SupabaseClient } from "../../db/supabase.client";
import type {
  CardDTO,
  CardsListDTO,
  CreateCardCommand,
  ErrorCode,
} from "../../types";
import { CardService as NewCardService } from "./card.service";

/**
 * Legacy CardService API Adapter
 * 
 * Provides backward compatibility with the old object literal API
 * while using the new class-based CardService internally.
 * 
 * @deprecated Use new CardService class directly instead
 * 
 * Migration guide:
 * Old: const result = await CardService.createCard(supabase, deckId, command);
 * New: const service = new CardService(supabase);
 *      const result = await service.createCard(deckId, command);
 */
export const CardService = {
  async createCard(
    supabase: SupabaseClient,
    deckId: string,
    command: CreateCardCommand
  ): Promise<CardDTO | { error: ErrorCode }> {
    const service = new NewCardService(supabase);
    const result = await service.createCard(deckId, command);
    return result.toUnion();
  },

  async createCardsBatch(
    supabase: SupabaseClient,
    deckId: string,
    userId: string,
    cards: CreateCardCommand[]
  ): Promise<CardDTO[] | { error: ErrorCode }> {
    const service = new NewCardService(supabase);
    const result = await service.createCardsBatch(deckId, userId, cards);
    return result.toUnion();
  },

  async getCardById(
    supabase: SupabaseClient,
    cardId: string,
    userId: string
  ): Promise<CardDTO | null> {
    const service = new NewCardService(supabase);
    return await service.getCardById(cardId, userId);
  },

  async verifyDeckOwnership(
    supabase: SupabaseClient,
    deckId: string,
    userId: string
  ): Promise<{ exists: boolean; owned: boolean }> {
    const service = new NewCardService(supabase);
    return await service.verifyDeckOwnership(deckId, userId);
  },

  async updateCard(
    supabase: SupabaseClient,
    cardId: string,
    userId: string,
    command: { question?: string; answer?: string }
  ): Promise<CardDTO | { error: ErrorCode }> {
    const service = new NewCardService(supabase);
    const result = await service.updateCard(cardId, userId, command);
    return result.toUnion();
  },

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
    const service = new NewCardService(supabase);
    const result = await service.listCards(deckId, userId, {
      ...options,
      searchTerm: options.q,
    });
    return result.toUnion();
  },
};
