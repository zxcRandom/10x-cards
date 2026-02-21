import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeckService } from "../deck.service";
import type { SupabaseClient } from "@/db/supabase.client";
import type { CreateDeckCommand } from "@/types";

describe("DeckService.createDeck", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
  });

  const userId = "user-123";
  const command: CreateDeckCommand = {
    name: "Test Deck",
    createdByAi: false,
  };

  it("should create a deck successfully and return the DTO", async () => {
    const mockDbResponse = {
      id: "deck-123",
      user_id: userId,
      name: "Test Deck",
      created_by_ai: false,
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
    };

    mockSupabase.single.mockResolvedValue({
      data: mockDbResponse,
      error: null,
    });

    const result = await DeckService.createDeck(userId, command, mockSupabase as SupabaseClient);

    expect(mockSupabase.from).toHaveBeenCalledWith("decks");
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      user_id: userId,
      name: command.name,
      created_by_ai: command.createdByAi,
    });
    expect(result).toEqual({
      id: "deck-123",
      name: "Test Deck",
      createdByAi: false,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    });
  });

  it("should throw an error when database operation fails", async () => {
    const mockError = {
      message: "Database error",
      code: "DB_ERROR",
    };

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: mockError,
    });

    await expect(DeckService.createDeck(userId, command, mockSupabase as SupabaseClient)).rejects.toThrow(
      "Failed to create deck: Database error"
    );
  });

  it("should throw an error when no data is returned", async () => {
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(DeckService.createDeck(userId, command, mockSupabase as SupabaseClient)).rejects.toThrow(
      "Deck creation failed: no data returned from database"
    );
  });
});
