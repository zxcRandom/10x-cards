import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { GET } from "../reviews";

describe("GET /api/v1/reviews", () => {
  const mockUrl = new URL("http://localhost:3000/api/v1/reviews");
  const mockUser = { id: "user-123" };

  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockLocals = {
    supabase: mockSupabase,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUrl.search = "";

    // Default auth success
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  it("should check deck ownership and return empty list if deck not owned", async () => {
    mockUrl.searchParams.set("deckId", "550e8400-e29b-41d4-a716-446655440000");

    // Mock implementation for 'from'
    mockSupabase.from.mockImplementation((table) => {
      if (table === "decks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }), // Deck not found/owned
              }),
            }),
          }),
        };
      }
      // Mock for reviews initialization
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn(),
        }),
      };
    });

    const response = await GET({
      url: mockUrl,
      locals: mockLocals,
    } as unknown as APIContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledWith("decks");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("cards");
  });

  it("should proceed to fetch cards if deck is owned", async () => {
    mockUrl.searchParams.set("deckId", "550e8400-e29b-41d4-a716-446655440000");

    mockSupabase.from.mockImplementation((table) => {
      if (table === "decks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "deck-1" }, error: null }), // Deck owned
              }),
            }),
          }),
        };
      }
      if (table === "cards") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: "card-1" }], error: null }),
          }),
        };
      }
      if (table === "reviews") {
        // Return a chainable object that resolves to empty
        const chain = {
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({ data: [], error: null }),
          then: (resolve) => resolve({ data: [], count: 0, error: null }),
        };
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      return { select: vi.fn() };
    });

    try {
      await GET({
        url: mockUrl,
        locals: mockLocals,
      } as unknown as APIContext);
    } catch {
      // Ignore errors from reviews query if any
    }

    expect(mockSupabase.from).toHaveBeenCalledWith("decks");
    expect(mockSupabase.from).toHaveBeenCalledWith("cards");
  });
});
