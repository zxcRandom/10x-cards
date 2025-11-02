import type { SupabaseClient } from "@/db/supabase.client";
import type { CreateDeckCommand, DbDeck, DeckDTO, DecksListDTO, UpdateDeckCommand } from "@/types";

/**
 * Options for listing decks with filtering, sorting, and pagination
 */
export interface ListDecksOptions {
  limit: number;
  offset: number;
  sort: "createdAt" | "updatedAt" | "name";
  order: "asc" | "desc";
  createdByAi?: boolean;
  q?: string;
}

/**
 * DeckService - Business logic for deck management
 *
 * Provides methods for CRUD operations on decks (flashcard collections).
 * All methods enforce authorization through Supabase RLS policies.
 */
export const DeckService = {
  /**
   * Creates a new deck for the authenticated user
   *
   * @param userId - User UUID from JWT token
   * @param command - Deck creation data (CreateDeckCommand)
   * @param supabase - Supabase client instance tied to the request
   * @returns Created DeckDTO
   * @throws Error - When database error occurs or deck creation fails
   *
   * @example
   * const deck = await DeckService.createDeck(
   *   user.id,
   *   { name: "Geography", createdByAi: false },
   *   supabase
   * );
   */
  async createDeck(userId: string, command: CreateDeckCommand, supabase: SupabaseClient): Promise<DeckDTO> {
    // Step 1: Prepare data for insert (snake_case for database)
    const insertData = {
      user_id: userId,
      name: command.name,
      created_by_ai: command.createdByAi ?? false,
    };

    // Step 2: Execute INSERT with RLS enforcement
    const { data, error } = await supabase.from("decks").insert(insertData).select().single();

    // Step 3: Handle database errors
    if (error) {
      console.error("[DeckService.createDeck] Database error:", {
        error: error.message,
        code: error.code,
        userId,
        deckName: command.name,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to create deck: ${error.message}`);
    }

    // Step 4: Validate response data
    if (!data) {
      console.error("[DeckService.createDeck] No data returned after insert:", {
        userId,
        deckName: command.name,
        timestamp: new Date().toISOString(),
      });

      throw new Error("Deck creation failed: no data returned from database");
    }

    // Step 5: Map database row to DTO (snake_case → camelCase)
    return this.mapDeckToDTO(data);
  },

  /**
   * Gets a single deck by ID for the authenticated user
   *
   * @param deckId - Deck UUID
   * @param userId - User UUID from JWT token
   * @param supabase - Supabase client instance tied to the request
   * @returns DeckDTO or null if deck not found or doesn't belong to user
   * @throws Error - When database error occurs
   *
   * @example
   * const deck = await DeckService.getDeckById(
   *   '550e8400-e29b-41d4-a716-446655440000',
   *   user.id,
   *   supabase
   * );
   */
  async getDeckById(deckId: string, userId: string, supabase: SupabaseClient): Promise<DeckDTO | null> {
    // Step 1: Query deck by ID and user_id (RLS enforcement)
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("id", deckId)
      .eq("user_id", userId)
      .maybeSingle();

    // Step 2: Handle database errors
    if (error) {
      console.error("[DeckService.getDeckById] Database error:", {
        error: error.message,
        code: error.code,
        deckId,
        userId,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to fetch deck: ${error.message}`);
    }

    // Step 3: Return null if deck not found (or doesn't belong to user)
    if (!data) {
      return null;
    }

    // Step 4: Map database row to DTO
    return this.mapDeckToDTO(data);
  },

  /**
   * Updates a deck's name for the authenticated user
   *
   * @param deckId - Deck UUID
   * @param userId - User UUID from JWT token
   * @param command - Update data (UpdateDeckCommand)
   * @param supabase - Supabase client instance tied to the request
   * @returns Updated DeckDTO or null if deck not found or doesn't belong to user
   * @throws Error - When database error occurs
   *
   * @example
   * const deck = await DeckService.updateDeck(
   *   '550e8400-e29b-41d4-a716-446655440000',
   *   user.id,
   *   { name: 'Updated Deck Name' },
   *   supabase
   * );
   */
  async updateDeck(
    deckId: string,
    userId: string,
    command: UpdateDeckCommand,
    supabase: SupabaseClient
  ): Promise<DeckDTO | null> {
    // Step 1: Prepare update data (snake_case for database)
    const updateData: Partial<DbDeck> = {};

    if (command.name !== undefined) {
      updateData.name = command.name;
    }

    // Step 2: Execute UPDATE with RLS enforcement
    const { data, error } = await supabase
      .from("decks")
      .update(updateData)
      .eq("id", deckId)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    // Step 3: Handle database errors
    if (error) {
      console.error("[DeckService.updateDeck] Database error:", {
        error: error.message,
        code: error.code,
        deckId,
        userId,
        command,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to update deck: ${error.message}`);
    }

    // Step 4: Return null if deck not found (or doesn't belong to user)
    if (!data) {
      return null;
    }

    // Step 5: Map database row to DTO
    return this.mapDeckToDTO(data);
  },

  /**
   * Deletes a deck for the authenticated user
   * CASCADE: All cards and reviews in this deck will be automatically deleted
   *
   * @param deckId - Deck UUID
   * @param userId - User UUID from JWT token
   * @param supabase - Supabase client instance tied to the request
   * @returns true if deck was deleted, false if deck not found or doesn't belong to user
   * @throws Error - When database error occurs
   *
   * @example
   * const deleted = await DeckService.deleteDeck(
   *   '550e8400-e29b-41d4-a716-446655440000',
   *   user.id,
   *   supabase
   * );
   */
  async deleteDeck(deckId: string, userId: string, supabase: SupabaseClient): Promise<boolean> {
    // Step 1: Execute DELETE with RLS enforcement
    const { data, error, count } = await supabase
      .from("decks")
      .delete({ count: "exact" })
      .eq("id", deckId)
      .eq("user_id", userId);

    // Step 2: Handle database errors
    if (error) {
      console.error("[DeckService.deleteDeck] Database error:", {
        error: error.message,
        code: error.code,
        deckId,
        userId,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to delete deck: ${error.message}`);
    }

    // Step 3: Return false if deck not found (or doesn't belong to user)
    // count will be 0 if no rows were deleted
    return (count ?? 0) > 0;
  },

  /**
   * Lists decks for the authenticated user with filtering, sorting, and pagination
   *
   * @param userId - User UUID from JWT token
   * @param options - Filtering, sorting, and pagination options
   * @param supabase - Supabase client instance tied to the request
   * @returns DecksListDTO with items, total count, limit, and offset
   * @throws Error - When database error occurs
   *
   * @example
   * const decks = await DeckService.listDecks(
   *   user.id,
   *   { limit: 20, offset: 0, sort: 'createdAt', order: 'desc' },
   *   supabase
   * );
   */
  async listDecks(userId: string, options: ListDecksOptions, supabase: SupabaseClient): Promise<DecksListDTO> {
    const { limit, offset, sort, order, createdByAi, q } = options;

    // Step 1: Map sort field from camelCase to snake_case
    const sortField = sort === "createdAt" ? "created_at" : sort === "updatedAt" ? "updated_at" : "name";

    // Step 2: Build base query with count
    let query = supabase.from("decks").select("*", { count: "exact" }).eq("user_id", userId);

    // Step 3: Apply optional filters
    if (createdByAi !== undefined) {
      query = query.eq("created_by_ai", createdByAi);
    }

    if (q) {
      query = query.ilike("name", `%${q}%`);
    }

    // Step 4: Apply sorting and pagination
    query = query.order(sortField, { ascending: order === "asc" }).range(offset, offset + limit - 1);

    // Step 5: Execute query
    const { data, error, count } = await query;

    // Step 6: Handle database errors
    if (error) {
      console.error("[DeckService.listDecks] Database error:", {
        error: error.message,
        code: error.code,
        userId,
        options,
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Failed to fetch decks: ${error.message}`);
    }

    // Step 7: Map results to DTOs
    const items = (data || []).map((deck) => this.mapDeckToDTO(deck));

    // Step 8: Return paginated response
    return {
      items,
      total: count ?? 0,
      limit,
      offset,
    };
  },

  /**
   * Maps database deck row to DeckDTO
   * Transforms snake_case field names to camelCase
   *
   * @param dbDeck - Database row from 'decks' table
   * @returns DeckDTO with camelCase fields
   * @private
   */
  mapDeckToDTO(dbDeck: DbDeck): DeckDTO {
    return {
      id: dbDeck.id,
      name: dbDeck.name,
      createdByAi: dbDeck.created_by_ai,
      createdAt: dbDeck.created_at,
      updatedAt: dbDeck.updated_at,
    };
  },
};
