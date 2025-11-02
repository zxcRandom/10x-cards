/**
 * EmptyState Component
 *
 * Displays a message when the user has no decks yet.
 * Provides CTA to encourage deck creation.
 */

import { FileQuestion } from "lucide-react";

interface EmptyStateProps {
  onCreateClick?: () => void;
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
        <FileQuestion className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Nie masz jeszcze żadnych talii</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Zacznij od wygenerowania fiszek za pomocą AI lub utwórz talię ręcznie
      </p>
      {onCreateClick && (
        <button onClick={onCreateClick} className="text-sm text-primary hover:underline font-medium">
          Wygeneruj fiszki →
        </button>
      )}
    </div>
  );
}
