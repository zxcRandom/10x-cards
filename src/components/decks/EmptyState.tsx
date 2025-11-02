/**
 * EmptyState Component
 *
 * Displays when user has no decks, with CTA to create first deck.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  onCreateClick: () => void;
}

export default function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <Card className="p-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <rect width="10" height="8" x="7" y="8" rx="1" />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Brak talii</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Nie masz jeszcze żadnych talii. Stwórz swoją pierwszą talię, aby rozpocząć naukę.
          </p>
        </div>
        <Button onClick={onCreateClick}>Stwórz nową talię</Button>
      </div>
    </Card>
  );
}
