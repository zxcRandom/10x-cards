/**
 * Custom hook for managing decks list
 *
 * Handles fetching, loading state, and error handling for decks list.
 */

import { useState, useEffect, useCallback } from "react";
import type { DecksListDTO } from "@/types";
import type { DeckListQuery, DecksListState } from "../decks/types";

interface UseDeckListResult {
  data: DecksListDTO | null;
  loading: boolean;
  error: Error | null;
  state: DecksListState;
  refetch: () => void;
}

export function useDecksList(query: DeckListQuery): UseDeckListResult {
  const [data, setData] = useState<DecksListDTO | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<DecksListState>("idle");

  const fetchDecks = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: query.limit.toString(),
        offset: query.offset.toString(),
        sort: query.sort,
        order: query.order,
      });

      if (query.createdByAi !== undefined) {
        params.set("createdByAi", query.createdByAi.toString());
      }

      if (query.q) {
        params.set("q", query.q);
      }

      const response = await fetch(`/api/v1/decks?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Twoja sesja wygasła. Zaloguj się ponownie.");
        }
        if (response.status === 400) {
          throw new Error("Nieprawidłowe parametry zapytania.");
        }
        throw new Error("Wystąpił błąd podczas pobierania talii.");
      }

      const result: DecksListDTO = await response.json();
      setData(result);
      setState("success");
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Nieznany błąd");
      setError(error);
      setState("error");
    }
  }, [query]);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  return {
    data,
    loading: state === "loading",
    error,
    state,
    refetch: fetchDecks,
  };
}
