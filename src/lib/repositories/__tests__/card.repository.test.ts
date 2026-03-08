/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CardRepository } from "../card.repository";
import type { SupabaseClient } from "../../../db/supabase.client";

describe("CardRepository", () => {
  let repository: CardRepository;
  let mockSupabase: any;

  // Factory to create a builder with spied methods
  const createBuilder = (mockResult: any = { data: [], error: null }) => {
    const builder: any = {
      selectArgs: null,
    };

    builder.select = vi.fn().mockImplementation((...args) => {
      builder.selectArgs = args;
      return builder;
    });
    builder.eq = vi.fn().mockReturnThis();
    builder.ilike = vi.fn().mockReturnThis();
    builder.order = vi.fn().mockReturnThis();
    builder.range = vi.fn().mockReturnThis();
    builder.single = vi.fn().mockImplementation(() => {
      return Promise.resolve(mockResult);
    });

    // The `then` method simulates the await for non-single calls
    builder.then = vi.fn().mockImplementation((resolve) => {
      const options = builder.selectArgs ? builder.selectArgs[1] : {};
      // Check if it's the combined query
      if (options?.count === "exact") {
        resolve({ count: 10, error: null, data: [{ id: "1" }, { id: "2" }] });
      } else {
        // Default data only query
        resolve(mockResult);
      }
    });

    return builder;
  };

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    } as unknown as SupabaseClient;

    repository = new CardRepository(mockSupabase);
  });

  describe("list", () => {
    it("should fetch cards and total count in a single query", async () => {
      const builder = createBuilder();
      mockSupabase.from.mockReturnValue(builder);

      const result = await repository.list("deck-123", {
        limit: 10,
        offset: 0,
        sort: "createdAt",
        order: "desc",
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(mockSupabase.from).toHaveBeenCalledWith("cards");
      expect(builder.select).toHaveBeenCalledWith("*", { count: "exact" });
    });
  });

  describe("findById", () => {
    it("should find a card by ID with deck ownership check", async () => {
      const mockCard = { id: "card-1", question: "Q", answer: "A" };
      const builder = createBuilder({ data: mockCard, error: null });
      mockSupabase.from.mockReturnValue(builder);

      const result = await repository.findById("card-1", "user-1");

      expect(mockSupabase.from).toHaveBeenCalledWith("cards");
      expect(builder.eq).toHaveBeenCalledWith("id", "card-1");
      expect(builder.eq).toHaveBeenCalledWith("decks.user_id", "user-1");
      expect(result).toEqual(mockCard);
    });
  });
});
