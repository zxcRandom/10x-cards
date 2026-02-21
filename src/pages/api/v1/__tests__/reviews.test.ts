import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../reviews';

describe('GET /api/v1/reviews', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

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
      // Mock the promise behavior
      then: vi.fn().mockImplementation((resolve) => {
         return Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
      }),
    };

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockImplementation((table) => {
        return queryBuilder;
      }),
    };

    mockLocals = {
      supabase: mockSupabase,
    };
  });

  it('should use JOIN query instead of separate fetch when filtering by deckId', async () => {
    mockUrl = new URL('http://localhost:3000/api/v1/reviews?deckId=00000000-0000-0000-0000-000000000001');
    const context = {
        url: mockUrl,
        locals: mockLocals,
        request: new Request(mockUrl),
    } as any;

    // We verify that we DON'T query 'cards' table directly
    const fromSpy = mockSupabase.from;

    await GET(context);

    // Check that we did NOT call `from('cards')`
    const calledTables = fromSpy.mock.calls.map((args: any[]) => args[0]);
    const cardsTableCalled = calledTables.includes('cards');

    expect(cardsTableCalled).toBe(false);

    // Check that select includes the join
    expect(queryBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('cards!inner(deck_id)')
    );

    // Check that we filter by the joined table column
    expect(queryBuilder.eq).toHaveBeenCalledWith(
        'cards.deck_id',
        '00000000-0000-0000-0000-000000000001'
    );
  });

  it('should not use JOIN query when deckId is not provided', async () => {
    mockUrl = new URL('http://localhost:3000/api/v1/reviews');
    const context = {
        url: mockUrl,
        locals: mockLocals,
        request: new Request(mockUrl),
    } as any;

    await GET(context);

    // Check that select does NOT include the join
    // We expect select("*") or select("*", ...) but NOT "cards!inner"
    // Note: The implementation might use select("*") initially.

    // We need to check all calls to select
    const selectCalls = queryBuilder.select.mock.calls.map((args: any[]) => args[0]);
    const hasJoin = selectCalls.some((arg: string) => arg && arg.includes('cards!inner'));

    expect(hasJoin).toBe(false);
  });
});
