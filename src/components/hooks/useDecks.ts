/**
 * Custom hook for fetching user's decks
 *
 * Handles fetching decks list with pagination and sorting options.
 * Provides loading states and error handling.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DecksListDTO, DeckDTO, ErrorResponse } from '@/types';

interface UseDecksParams {
  limit?: number;
  offset?: number;
  sort?: 'updatedAt' | 'createdAt' | 'name';
  order?: 'desc' | 'asc';
  autoFetch?: boolean; // Whether to fetch automatically on mount
}

interface UseDecksResult {
  data: DeckDTO[] | null;
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDecks(params: UseDecksParams = {}): UseDecksResult {
  const {
    limit = 10,
    offset = 0,
    sort = 'updatedAt',
    order = 'desc',
    autoFetch = true,
  } = params;

  const [data, setData] = useState<DeckDTO[] | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sort,
        order,
      });

      const response = await fetch(`/api/v1/decks?${queryParams.toString()}`);

      if (!response.ok) {
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          const errorData = await response.json() as ErrorResponse;
          
          switch (response.status) {
            case 401:
              setError('Wymagane zalogowanie');
              break;
            case 500:
              setError('Wystąpił błąd serwera. Spróbuj ponownie później.');
              break;
            default:
              setError(errorData.error.message || 'Wystąpił błąd podczas pobierania talii');
          }
        } else {
          setError('Wystąpił błąd serwera');
        }

        setData(null);
        setTotal(0);
        return;
      }

      const result = await response.json() as DecksListDTO;
      setData(result.items);
      setTotal(result.total);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || 'Wystąpił błąd podczas pobierania talii');
      } else {
        setError('Wystąpił nieoczekiwany błąd');
      }
      setData(null);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, sort, order]);

  useEffect(() => {
    if (autoFetch) {
      fetchDecks();
    }
  }, [autoFetch, fetchDecks]);

  return {
    data,
    total,
    isLoading,
    error,
    refetch: fetchDecks,
  };
}
