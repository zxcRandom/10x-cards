import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../reviews";
import type { APIContext } from "astro";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

// Mock Astro locals
const mockLocals = {
  supabase: mockSupabase,
};

// Mock Astro request context
const createMockContext = (url: string) =>
  ({
    url: new URL(url),
    locals: mockLocals,
  }) as unknown as APIContext;

describe("GET /api/v1/reviews performance benchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
  });

  it("should verify the number of database queries", async () => {
    // Setup query builder mock
    // We need to return a new builder for each call to 'from'
    // to simulate independent queries

    const mockData = [{ id: "1", card_id: "c1", user_id: "u1", grade: 5, review_date: "2023-01-01" }];

    const mockCount = 10;

    // We need to handle the chainable methods
    const createQueryBuilder = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};

      builder.select = vi.fn().mockReturnThis();
      builder.eq = vi.fn().mockReturnThis();
      builder.in = vi.fn().mockReturnThis();
      builder.gte = vi.fn().mockReturnThis();
      builder.lte = vi.fn().mockReturnThis();
      builder.order = vi.fn().mockReturnThis();
      builder.range = vi.fn().mockReturnThis();

      // The promise resolution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      builder.then = (resolve: any, reject: any) => {
        // If select was called with count option, return count
        // We can inspect the last call to select to decide what to return
        const lastSelectCall = builder.select.mock.calls[builder.select.mock.calls.length - 1];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = { data: mockData, error: null };

        if (lastSelectCall && lastSelectCall[1] && lastSelectCall[1].count === "exact") {
          result.count = mockCount;
        }

        // If it's the separate count query (head: true), it might return null data?
        if (lastSelectCall && lastSelectCall[1] && lastSelectCall[1].head === true) {
          result.data = null;
        }

        return Promise.resolve(result).then(resolve, reject);
      };

      return builder;
    };

    mockSupabase.from.mockImplementation(() => createQueryBuilder());

    const context = createMockContext("http://localhost:3000/api/v1/reviews?limit=10&offset=0");

    const response = await GET(context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(10);

    // Analyze calls to 'from'
    // In unoptimized code:
    // 1. from('reviews') for data
    // 2. from('reviews') for count
    // So we expect 2 calls.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewsCalls = mockSupabase.from.mock.calls.filter((args: any) => args[0] === "reviews");

    // This assertion verifies the optimization
    expect(reviewsCalls.length).toBe(1);
  });
});
