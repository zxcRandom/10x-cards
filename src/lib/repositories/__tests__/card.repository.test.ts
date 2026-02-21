/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CardRepository } from "../card.repository";
import type { SupabaseClient } from "../../../db/supabase.client";

describe("CardRepository", () => {
  let repository: CardRepository;
  let mockSupabase: any;
  let builders: any[];

  beforeEach(() => {
    builders = [];

    // Factory to create a builder with spied methods
    const createBuilder = () => {
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
      builder.single = vi.fn();

      // The `then` method simulates the await
      builder.then = vi.fn().mockImplementation((resolve) => {
        const options = builder.selectArgs ? builder.selectArgs[1] : {};
        // Check if it's the combined query
        // It has count: 'exact' but no head: true
        if (options?.count === "exact" && !options?.head) {
          resolve({ count: 10, error: null, data: [{ id: "1" }, { id: "2" }] });
        } else if (options?.count === "exact" && options?.head) {
          // Count only query (old way)
          resolve({ count: 10, error: null, data: [] });
        } else {
          // Data only query (old way)
          resolve({ data: [{ id: "1" }, { id: "2" }], error: null, count: null });
        }
      });

      builders.push(builder);
      return builder;
    };

    mockSupabase = {
      from: vi.fn().mockImplementation(() => createBuilder()),
    } as unknown as SupabaseClient;

    repository = new CardRepository(mockSupabase);
  });

  describe("list", () => {
    it("should fetch cards and total count", async () => {
      const deckId = "deck-123";

      const result = await repository.list(deckId, {
        limit: 10,
        offset: 0,
        sort: "createdAt",
        order: "desc",
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);

      // Optimized implementation: 1 combined query
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Verify query was for data AND count
      expect(builders[0].select).toHaveBeenCalledWith("*", { count: "exact" });
    });
  });
});
