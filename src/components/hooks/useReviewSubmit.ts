/**
 * useReviewSubmit Hook
 *
 * Custom hook for submitting card reviews to API
 * Handles submission state and error notifications
 */

import { useState, useCallback } from "react";
import type { ReviewGrade, ReviewResponseDTO } from "@/types";
import { toast } from "sonner";

interface UseReviewSubmitResult {
  isSubmitting: boolean;
  submitReview: (cardId: string, grade: ReviewGrade) => Promise<ReviewResponseDTO | null>;
}

export function useReviewSubmit(): UseReviewSubmitResult {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReview = useCallback(async (cardId: string, grade: ReviewGrade): Promise<ReviewResponseDTO | null> => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/cards/${cardId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grade }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: {
            code: "UNKNOWN_ERROR",
            message: "Wystąpił nieznany błąd",
          },
        }));

        if (response.status === 429) {
          toast.error("Przekroczono limit ocen. Spróbuj ponownie później.");
        } else if (response.status === 503) {
          toast.error("Serwis recenzji jest chwilowo niedostępny. Odczekaj i spróbuj ponownie.");
        } else {
          toast.error(errorData.error?.message || "Nie udało się zapisać oceny");
        }
        setIsSubmitting(false);
        return null;
      }

      const reviewResponse: ReviewResponseDTO = await response.json();
      setIsSubmitting(false);
      return reviewResponse;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error submitting review:", err);
      toast.error("Nie udało się zapisać oceny. Spróbuj ponownie.");
      setIsSubmitting(false);
      return null;
    }
  }, []);

  return {
    isSubmitting,
    submitReview,
  };
}
