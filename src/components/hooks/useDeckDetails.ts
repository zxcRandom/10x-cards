/**
 * useDeckDetails Hook
 *
 * Manages state for deck details view including cards list,
 * pagination, sorting, and search.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CardDTO, CardsListDTO, DeckDTO } from "@/types";
import type { CardsListQuery, DeckDetailsState, CardsSort, SortOrder } from "../deck/types";
import { toast } from "sonner";

interface UseDeckDetailsOptions {
  deckId: string;
  initialDeck: DeckDTO;
}

export function useDeckDetails({ deckId, initialDeck }: UseDeckDetailsOptions) {
  const [state, setState] = useState<DeckDetailsState>({
    deck: initialDeck,
    cards: [],
    total: 0,
    query: {
      limit: 20,
      offset: 0,
      sort: "createdAt",
      order: "desc",
      q: "",
    },
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load cards based on current query
  const loadCards = useCallback(
    async (query: CardsListQuery) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams({
          limit: query.limit.toString(),
          offset: query.offset.toString(),
          sort: query.sort,
          order: query.order,
        });

        if (query.q && query.q.trim()) {
          params.append("q", query.q.trim());
        }

        const response = await fetch(`/api/v1/decks/${deckId}/cards?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Twoja sesja wygasła. Zaloguj się ponownie.");
          }
          if (response.status === 404) {
            throw new Error("Talia nie została znaleziona.");
          }
          throw new Error("Wystąpił błąd podczas ładowania kart");
        }

        const data: CardsListDTO = await response.json();

        setState((prev) => ({
          ...prev,
          cards: data.items,
          total: data.total,
          loading: false,
        }));
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const errorMessage = err instanceof Error ? err.message : "Nieznany błąd";

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        toast.error(errorMessage);
      }
    },
    [deckId]
  );

  // Load cards when query changes
  useEffect(() => {
    loadCards(state.query);
  }, [state.query, loadCards]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Actions
  const setQuery = useCallback((updates: Partial<CardsListQuery>) => {
    setState((prev) => ({
      ...prev,
      query: { ...prev.query, ...updates },
    }));
  }, []);

  const setSearch = useCallback((q: string) => {
    setState((prev) => ({
      ...prev,
      query: { ...prev.query, q, offset: 0 },
    }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState((prev) => ({
      ...prev,
      query: { ...prev.query, limit, offset: 0 },
    }));
  }, []);

  const setSort = useCallback((sort: CardsSort, order: SortOrder) => {
    setState((prev) => ({
      ...prev,
      query: { ...prev.query, sort, order },
    }));
  }, []);

  const setOffset = useCallback((offset: number) => {
    setState((prev) => ({
      ...prev,
      query: { ...prev.query, offset },
    }));
  }, []);

  const updateDeck = useCallback((deck: DeckDTO) => {
    setState((prev) => ({ ...prev, deck }));
  }, []);

  const refreshCards = useCallback(() => {
    loadCards(state.query);
  }, [state.query, loadCards]);

  const resetToFirstPage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      query: { ...prev.query, offset: 0 },
    }));
  }, []);

  return {
    state,
    actions: {
      setQuery,
      setSearch,
      setLimit,
      setSort,
      setOffset,
      updateDeck,
      refreshCards,
      resetToFirstPage,
    },
  };
}
