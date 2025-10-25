/**
 * EmptyState Component
 * 
 * Displays message when there are no cards due for review
 */

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  deckId: string;
}

export default function EmptyState({ deckId }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <h2 className="text-xl font-semibold mb-4">Brak kart do nauki</h2>
      <p className="text-muted-foreground mb-6">
        Nie masz teraz żadnych kart do powtórki. Wróć później!
      </p>
      <Button asChild>
        <a href={`/decks/${deckId}`}>Powrót do talii</a>
      </Button>
    </div>
  );
}
