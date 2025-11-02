/**
 * useDueCards Hook
 *
 * Custom hook for fetching due cards from API
 * Handles loading state, errors, and provides refetch capability
 */

import { useState, useCallback } from "react";
import type { DueCardsListDTO } from "@/types";
import type { StudyCardVM, ApiErrorUI } from "../study/types";

interface UseDueCardsResult {
  cards: StudyCardVM[];
  loading: boolean;
  error: ApiErrorUI | undefined;
  fetchCards: () => Promise<void>;
}

export function useDueCards(deckId: string): UseDueCardsResult {
  const [cards, setCards] = useState<StudyCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorUI | undefined>();

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const now = new Date().toISOString();
      const url = `/api/v1/decks/${deckId}/cards/due?before=${encodeURIComponent(now)}&limit=50&offset=0&order=asc`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: {
            code: "UNKNOWN_ERROR",
            message: "Wystąpił nieznany błąd",
          },
        }));

        setError({
          status: response.status,
          code: errorData.error?.code || "UNKNOWN_ERROR",
          message: errorData.error?.message || "Wystąpił błąd podczas pobierania kart",
          details: errorData.error?.details,
        });
        setLoading(false);
        return;
      }

      const data: DueCardsListDTO = await response.json();

      // Map API DTOs to view models
      const cardVMs: StudyCardVM[] = data.items.map((card) => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
        nextReviewDate: card.nextReviewDate,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        easeFactor: card.easeFactor,
      }));

      setCards(cardVMs);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching due cards:", err);
      setError({
        status: 500,
        code: "NETWORK_ERROR",
        message: "Nie udało się połączyć z serwerem",
      });
      setLoading(false);
    }
  }, [deckId]);

  return {
    cards,
    loading,
    error,
    fetchCards,
  };
}
