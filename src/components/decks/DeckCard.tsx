/**
 * DeckCard Component
 * 
 * Single deck card showing name, AI badge, dates, and actions.
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DeckDTO } from '@/types';

interface DeckCardProps {
  deck: DeckDTO;
  onEdit: (deck: DeckDTO) => void;
  onDelete: (deck: DeckDTO) => void;
}

export default function DeckCard({ deck, onEdit, onDelete }: DeckCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{deck.name}</h3>
          {deck.createdByAi && (
            <Badge variant="secondary" className="mt-1">
              AI
            </Badge>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <div>Utworzono: {formatDate(deck.createdAt)}</div>
        <div>Aktualizowano: {formatDate(deck.updatedAt)}</div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={() => (window.location.href = `/decks/${deck.id}`)}
        >
          Otwórz
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(deck)}
        >
          Edytuj
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(deck)}
        >
          Usuń
        </Button>
      </div>
    </Card>
  );
}
