import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardRepository } from '../card.repository';
import type { SupabaseClient } from '../../../db/supabase.client';

describe('CardRepository', () => {
  let repository: CardRepository;
  let mockSupabase: any;
  let mockSelect: any;
  let mockEq: any;
  let mockIlike: any;
  let mockOrder: any;
  let mockRange: any;

  beforeEach(() => {
    // Setup mock chain
    // Simulate the PostgREST chain: from -> select -> eq -> [ilike] -> order -> range -> Promise

    mockRange = vi.fn().mockResolvedValue({ data: [], count: 10, error: null });

    mockOrder = vi.fn().mockReturnValue({
      range: mockRange
    });

    mockIlike = vi.fn().mockReturnValue({
      order: mockOrder
    });

    mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
      ilike: mockIlike
    });

    // select returns the builder which has eq
    mockSelect = vi.fn().mockReturnValue({
      eq: mockEq
    });

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect
      }),
    };

    repository = new CardRepository(mockSupabase as unknown as SupabaseClient);
  });

  it('should list cards with count in a single query', async () => {
    const deckId = 'test-deck-id';
    const options = {
      limit: 10,
      offset: 0,
      sort: 'createdAt' as const,
      order: 'desc' as const,
    };

    // Mock .eq() to return a Thenable for backwards compatibility during refactor
    // (though not strictly needed if we only test the NEW implementation)
    // but useful if we want to ensure the mock is robust.
    const mockCountResult = { count: 5, error: null };

    const builder = {
        order: mockOrder,
        ilike: mockIlike,
        then: (resolve: any) => resolve(mockCountResult)
    };

    mockEq.mockReturnValue(builder);

    await repository.list(deckId, options);

    // Verify that select was called with count: 'exact'
    // The expectation is that we optimize to a single query that requests count
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' });

    // Verify only one query was executed (by checking if from was called only once)
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});
