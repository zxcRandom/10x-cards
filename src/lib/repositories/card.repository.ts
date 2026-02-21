import type { SupabaseClient } from "../../db/supabase.client";
import type { DbCard, CreateCardCommand } from "../../types";
import { SM2Parameters } from "../domain/sm2-parameters";

/**
 * Query options for listing cards
 */
export interface CardListOptions {
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
  searchTerm?: string;
}

/**
 * Result of list operation with pagination info
 */
export interface CardListResult {
  items: DbCard[];
  total: number;
}

/**
 * CardRepository - Data Access Layer for Card operations
 *
 * Responsible exclusively for database operations, with no business logic.
 * All methods return raw database records (DbCard) or null/undefined for not found cases.
 * Error handling is minimal - database errors are thrown to be handled by the service layer.
 *
 * Following Repository Pattern principles:
 * - Single Responsibility: Only database access
 * - Separation of Concerns: No business rules
 * - Testability: Easy to mock for service tests
 */
export class CardRepository {
  /**
   * Mapping from query field names to database column names
   */
  private static readonly SORT_FIELD_MAP: Record<string, string> = {
    createdAt: "created_at",
    updatedAt: "updated_at",
    nextReviewDate: "next_review_date",
    easeFactor: "ease_factor",
    intervalDays: "interval_days",
    repetitions: "repetitions",
    question: "question",
    answer: "answer",
  };

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Finds a card by ID with deck ownership verification
   *
   * @param cardId - UUID of the card
   * @param userId - UUID of the user (for ownership check via deck)
   * @returns Card record or null if not found or access denied
   */
  async findById(cardId: string, userId: string): Promise<DbCard | null> {
    const { data, error } = await this.supabase
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

    if (error || !data) {
      return null;
    }

    return data as DbCard;
  }

  /**
   * Creates a new card in the database
   *
   * @param deckId - UUID of the deck
   * @param command - Card creation data
   * @param sm2Params - SM-2 algorithm parameters
   * @param nextReviewDate - ISO-8601 timestamp for next review
   * @returns Created card record
   * @throws Error if database operation fails
   */
  async create(
    deckId: string,
    command: CreateCardCommand,
    sm2Params: SM2Parameters,
    nextReviewDate: string
  ): Promise<DbCard> {
    const { data, error } = await this.supabase
      .from("cards")
      .insert({
        deck_id: deckId,
        question: command.question.trim(),
        answer: command.answer.trim(),
        ...sm2Params.toDatabase(),
        next_review_date: nextReviewDate,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("No data returned after card insert");
    }

    return data as DbCard;
  }

  /**
   * Creates multiple cards in a single batch operation
   *
   * @param deckId - UUID of the deck
   * @param commands - Array of card creation data
   * @param sm2Params - SM-2 parameters to apply to all cards
   * @param nextReviewDate - Review date to apply to all cards
   * @returns Array of created card records
   * @throws Error if database operation fails
   */
  async createBatch(
    deckId: string,
    commands: CreateCardCommand[],
    sm2Params: SM2Parameters,
    nextReviewDate: string
  ): Promise<DbCard[]> {
    const cardInserts = commands.map((card) => ({
      deck_id: deckId,
      question: card.question.trim(),
      answer: card.answer.trim(),
      ...sm2Params.toDatabase(),
      next_review_date: nextReviewDate,
    }));

    const { data, error } = await this.supabase.from("cards").insert(cardInserts).select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error("No data returned after batch card insert");
    }

    return data as DbCard[];
  }

  /**
   * Updates a card's question and/or answer
   *
   * @param cardId - UUID of the card
   * @param updates - Fields to update (question and/or answer)
   * @returns Updated card record
   * @throws Error if database operation fails
   */
  async update(cardId: string, updates: { question?: string; answer?: string }): Promise<DbCard> {
    const updateData: Partial<{ question: string; answer: string }> = {};

    if (updates.question !== undefined) {
      updateData.question = updates.question.trim();
    }
    if (updates.answer !== undefined) {
      updateData.answer = updates.answer.trim();
    }

    const { data, error } = await this.supabase.from("cards").update(updateData).eq("id", cardId).select().single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("No data returned after card update");
    }

    return data as DbCard;
  }

  /**
   * Lists cards in a deck with filtering, sorting, and pagination
   *
   * @param deckId - UUID of the deck
   * @param options - Query options (pagination, sorting, search)
   * @returns Cards and total count
   * @throws Error if database operation fails
   */
  async list(deckId: string, options: CardListOptions): Promise<CardListResult> {
    const sortField = CardRepository.SORT_FIELD_MAP[options.sort];

    // Build query for cards
    let query = this.supabase.from("cards").select("*", { count: "exact" }).eq("deck_id", deckId);

    // Add search filter if provided
    if (options.searchTerm) {
      query = query.ilike("question", `%${options.searchTerm}%`);
    }

    // Add sorting
    query = query.order(sortField, { ascending: options.order === "asc" });

    // Add pagination
    query = query.range(options.offset, options.offset + options.limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      items: (data || []) as DbCard[],
      total: count || 0,
    };
  }

  /**
   * Verifies if a card exists and user has access to it via deck ownership
   *
   * @param cardId - UUID of the card
   * @param userId - UUID of the user
   * @returns true if card exists and user owns the deck, false otherwise
   */
  async verifyCardOwnership(cardId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
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

    return !error && !!data;
  }

  /**
   * Verifies if a deck exists and belongs to the user
   *
   * @param deckId - UUID of the deck
   * @param userId - UUID of the user
   * @returns Object with exists and owned flags
   */
  async verifyDeckOwnership(deckId: string, userId: string): Promise<{ exists: boolean; owned: boolean }> {
    const { data, error } = await this.supabase.from("decks").select("id, user_id").eq("id", deckId).single();

    if (error || !data) {
      return { exists: false, owned: false };
    }

    return {
      exists: true,
      owned: data.user_id === userId,
    };
  }

  /**
   * Deletes a card from the database
   *
   * @param cardId - UUID of the card to delete
   * @throws Error if database operation fails
   */
  async delete(cardId: string): Promise<void> {
    const { error } = await this.supabase.from("cards").delete().eq("id", cardId);

    if (error) {
      throw error;
    }
  }
}
