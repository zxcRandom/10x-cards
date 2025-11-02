import { AICardItem } from "./AICardItem";
import type { ReviewCardVM } from "./types";

interface CardsListProps {
  items: ReviewCardVM[];
  onEdit: (cardId: string, question: string, answer: string) => void;
  onDiscard: (cardId: string) => void;
  onToggleSelect: (cardId: string) => void;
}

/**
 * CardsList - List of flashcards for review
 *
 * Displays all cards in a grid layout
 */
export function CardsList({ items, onEdit, onDiscard, onToggleSelect }: CardsListProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Brak fiszek do wyświetlenia. Wszystkie fiszki zostały odrzucone.</p>
      </div>
    );
  }

  return (
    <div className="mb-24 space-y-4">
      {items.map((card) => (
        <AICardItem key={card.id} card={card} onEdit={onEdit} onDiscard={onDiscard} onToggleSelect={onToggleSelect} />
      ))}
    </div>
  );
}
