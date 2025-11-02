/**
 * RecentDecksList Component
 *
 * Displays a list of recently updated decks.
 * Uses the useDecks hook to fetch data.
 */

import { useDecks } from "@/components/hooks/useDecks";
import { DeckCard } from "./DeckCard";
import { EmptyState } from "./EmptyState";
import type { RecentDecksListProps } from "./types";
import { Loader2 } from "lucide-react";

export function RecentDecksList({ limit = 6, sort = "updatedAt", order = "desc" }: RecentDecksListProps) {
  const { data, isLoading, error } = useDecks({
    limit,
    offset: 0,
    sort,
    order,
    autoFetch: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-destructive mb-2">Wystąpił błąd podczas ładowania talii</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Ostatnie talie</h2>
        <a href="/decks" className="text-sm text-primary hover:underline font-medium">
          Zobacz wszystkie →
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((deck) => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>
    </div>
  );
}
