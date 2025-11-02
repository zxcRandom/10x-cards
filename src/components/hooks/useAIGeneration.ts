/**
 * Custom hook for AI flashcard generation
 *
 * Handles the complete lifecycle of AI generation:
 * - Form submission and validation
 * - Fetch request with AbortController
 * - Loading states and error handling
 * - Cancellation support
 */

import { useState, useRef, useCallback } from "react";
import type {
  CreateAIDeckCommand,
  AIDeckResponseDTO,
  ErrorResponse,
  ValidationErrorResponse,
  UnprocessableErrorResponse,
} from "@/types";
import type { AIGeneratorState } from "@/components/dashboard/types";

interface UseAIGenerationResult {
  generate: (command: CreateAIDeckCommand) => Promise<AIDeckResponseDTO | null>;
  cancel: () => void;
  state: AIGeneratorState;
  error: string | null;
  data: AIDeckResponseDTO | null;
}

export function useAIGeneration(): UseAIGenerationResult {
  const [state, setState] = useState<AIGeneratorState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIDeckResponseDTO | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState("idle");
      setError(null);
    }
  }, []);

  const generate = useCallback(async (command: CreateAIDeckCommand): Promise<AIDeckResponseDTO | null> => {
    // Reset state
    setError(null);
    setData(null);
    setState("loading");

    // Create new AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        // Handle different error status codes
        const contentType = response.headers.get("content-type");

        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          const errorCode = errorData?.error?.code;

          switch (response.status) {
            case 400:
              // Validation error
              const validationError = errorData as ValidationErrorResponse;
              setError(validationError.error.message || "Błąd walidacji danych");
              break;
            case 401:
              setError("Wymagane zalogowanie");
              break;
            case 422:
              // AI processing error
              const processingError = errorData as UnprocessableErrorResponse;
              setError(
                processingError.error.message ||
                  "Nie udało się przetworzyć odpowiedzi AI. Spróbuj skrócić tekst lub zmniejszyć liczbę kart."
              );
              break;
            case 429:
              setError("Przekroczono limit żądań. Spróbuj ponownie później.");
              break;
            case 503:
              setError("Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za kilka minut.");
              break;
            case 500:
            case 504:
              setError(
                errorCode === "TOO_MANY_REQUESTS"
                  ? "Limit zapytań do usługi AI został osiągnięty. Spróbuj ponownie później."
                  : "Wystąpił błąd serwera. Spróbuj ponownie później."
              );
              break;
            default:
              const genericError = errorData as ErrorResponse;
              setError(genericError.error.message || "Wystąpił nieoczekiwany błąd");
          }
        } else {
          setError("Wystąpił błąd serwera");
        }

        setState("error");
        return null;
      }

      const result = (await response.json()) as AIDeckResponseDTO;
      setData(result);
      setState("success");
      return result;
    } catch (err) {
      // Handle fetch errors
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          // Request was cancelled - this is expected, don't treat as error
          setState("idle");
          return null;
        }
        setError(err.message || "Wystąpił błąd podczas generowania fiszek");
      } else {
        setError("Wystąpił nieoczekiwany błąd");
      }
      setState("error");
      return null;
    }
  }, []);

  return {
    generate,
    cancel,
    state,
    error,
    data,
  };
}
