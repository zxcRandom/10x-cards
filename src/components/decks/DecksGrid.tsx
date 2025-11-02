/**
 * DecksGrid Component
 *
 * Displays deck cards in responsive grid.
 */

import DeckCard from "./DeckCard";
import type { DeckDTO } from "@/types";

interface DecksGridProps {
  items: DeckDTO[];
  onEdit: (deck: DeckDTO) => void;
  onDelete: (deck: DeckDTO) => void;
}

export default function DecksGrid({ items, onEdit, onDelete }: DecksGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((deck) => (
        <DeckCard key={deck.id} deck={deck} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
