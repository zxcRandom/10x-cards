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
import type { CreateAIDeckCommand, AIDeckResponseDTO } from "@/types";
import { getAIErrorMessage } from "@/lib/utils/ai-error-mapper";
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
        const errorMessage = await getAIErrorMessage(response);
        setError(errorMessage);
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
