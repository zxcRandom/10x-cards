import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { EditCardDialog } from './EditCardDialog';
import type { ReviewCardVM } from './types';

interface AICardItemProps {
  card: ReviewCardVM;
  onEdit: (cardId: string, question: string, answer: string) => void;
  onDiscard: (cardId: string) => void;
  onToggleSelect: (cardId: string) => void;
}

/**
 * AICardItem - Single flashcard for review
 *
 * Shows card content with checkbox and action buttons
 */
export function AICardItem({
  card,
  onEdit,
  onDiscard,
  onToggleSelect,
}: AICardItemProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEditSubmit = (question: string, answer: string) => {
    onEdit(card.id, question, answer);
    setDialogOpen(false);
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="pt-1">
            <Checkbox
              id={`card-${card.id}`}
              checked={card.selected}
              onCheckedChange={() => onToggleSelect(card.id)}
              aria-label="Zaznacz fiszkę do zapisu"
            />
          </div>

          {/* Card content */}
          <div className="flex-1 space-y-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  PYTANIE
                </span>
                {card.edited && (
                  <Badge variant="secondary" className="text-xs">
                    Edytowano
                  </Badge>
                )}
              </div>
              <p className="text-sm">{card.question}</p>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                ODPOWIEDŹ
              </div>
              <p className="text-sm">{card.answer}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                size="sm"
              >
                Edytuj
              </Button>
              <Button
                onClick={() => onDiscard(card.id)}
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Odrzuć
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit dialog */}
      <EditCardDialog
        open={dialogOpen}
        initialValue={{ question: card.question, answer: card.answer }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
