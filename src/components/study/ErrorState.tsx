/**
 * ErrorState Component
 * 
 * Displays error message with appropriate action buttons
 * Handles different error scenarios (404, network errors, etc.)
 */

import { Button } from "@/components/ui/button";
import type { ApiErrorUI } from "./types";

interface ErrorStateProps {
  error: ApiErrorUI;
  onRetry: () => void;
}

export default function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <h2 className="text-xl font-semibold mb-4">Wystąpił błąd</h2>
      <p className="text-muted-foreground mb-6">{error.message}</p>
      {error.status === 404 ? (
        <Button asChild>
          <a href="/decks">Powrót do talii</a>
        </Button>
      ) : (
        <div className="flex gap-4">
          <Button onClick={onRetry}>Ponów próbę</Button>
          <Button variant="outline" asChild>
            <a href="/decks">Powrót do talii</a>
          </Button>
        </div>
      )}
    </div>
  );
}
