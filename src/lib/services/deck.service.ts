import type { SupabaseClient } from "@/db/supabase.client";
import type { CreateDeckCommand, DbDeck, DeckDTO } from "@/types";

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
  async createDeck(
    userId: string,
    command: CreateDeckCommand,
    supabase: SupabaseClient
  ): Promise<DeckDTO> {
    // Step 1: Prepare data for insert (snake_case for database)
    const insertData = {
      user_id: userId,
      name: command.name,
      created_by_ai: command.createdByAi ?? false,
    };

    // Step 2: Execute INSERT with RLS enforcement
    const { data, error } = await supabase
      .from("decks")
      .insert(insertData)
      .select()
      .single();

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
