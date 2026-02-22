/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../reviews";

describe("GET /api/v1/reviews", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  let mockSupabase: any;
  let mockLocals: any;
  let mockUrl: URL;
  let queryBuilder: any;

  beforeEach(() => {
    // Generic query builder that returns itself for chaining
    queryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "deck-1" }, error: null }),
      // Mock the promise behavior
      then: vi.fn().mockImplementation((resolve) => {
        // Return count: 10 if select was called with count option
        const lastSelectCall = queryBuilder.select.mock.calls[queryBuilder.select.mock.calls.length - 1];
        const result: any = { data: [], error: null };
        if (lastSelectCall && lastSelectCall[1] && lastSelectCall[1].count === "exact") {
          result.count = 10;
        }
        return Promise.resolve(result).then(resolve);
      }),
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      from: vi.fn().mockImplementation((_table) => {
        return queryBuilder;
      }),
    };

    mockLocals = {
      supabase: mockSupabase,
    };
  });

  describe("performance", () => {
    it("should verify the number of database queries", async () => {
      mockUrl = new URL("http://localhost:3000/api/v1/reviews?limit=10&offset=0");
      const context = {
        url: mockUrl,
        locals: mockLocals,
        request: new Request(mockUrl),
      } as any;

      const response = await GET(context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.total).toBe(10);

      // Analyze calls to 'from'
      // We expect 1 call to 'from' for reviews in the optimized implementation.
      const reviewsCalls = mockSupabase.from.mock.calls.filter((args: any) => args[0] === "reviews");
      expect(reviewsCalls.length).toBe(1);
    });
  });

  describe("logic", () => {
    it("should use JOIN query instead of separate fetch when filtering by deckId", async () => {
      mockUrl = new URL("http://localhost:3000/api/v1/reviews?deckId=00000000-0000-0000-0000-000000000001");
      const context = {
        url: mockUrl,
        locals: mockLocals,
        request: new Request(mockUrl),
      } as any;

      // Reset the from spy to count calls for this test specifically
      const fromSpy = mockSupabase.from;

      await GET(context);

      // Check that we did NOT call `from('cards')` for data (we used inner join)
      // Note: we might call `from('decks')` for security check
      const calledTables = fromSpy.mock.calls.map((args: any[]) => args[0]);
      const cardsTableCalled = calledTables.includes("cards");

      expect(cardsTableCalled).toBe(false);

      // Check that select includes the join
      expect(queryBuilder.select).toHaveBeenCalledWith(
        expect.stringContaining("cards!inner(deck_id)"),
        expect.objectContaining({ count: "exact" })
      );

      // Check that we filter by the joined table column
      expect(queryBuilder.eq).toHaveBeenCalledWith("cards.deck_id", "00000000-0000-0000-0000-000000000001");
    });

    it("should not use JOIN query when deckId is not provided", async () => {
      mockUrl = new URL("http://localhost:3000/api/v1/reviews");
      const context = {
        url: mockUrl,
        locals: mockLocals,
        request: new Request(mockUrl),
      } as any;

      await GET(context);

      // We need to check all calls to select
      const selectCalls = queryBuilder.select.mock.calls.map((args: any[]) => args[0]);
      const hasJoin = selectCalls.some((arg: string) => arg && arg.includes("cards!inner"));

      expect(hasJoin).toBe(false);
    });
  });
});
