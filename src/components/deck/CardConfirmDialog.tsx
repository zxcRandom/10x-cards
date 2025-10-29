/**
 * CardConfirmDialog Component
 * 
 * Confirmation dialog for deleting a flashcard.
 * Shows card preview and requires explicit confirmation.
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import type { CardDTO } from '@/types';

interface CardConfirmDialogProps {
  open: boolean;
  card: CardDTO | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (cardId: string) => void;
}

export default function CardConfirmDialog({
  open,
  card,
  onOpenChange,
  onConfirm,
}: CardConfirmDialogProps) {
  const handleConfirm = () => {
    if (card) {
      onConfirm(card.id);
    }
  };

  // Truncate question for preview (max 100 characters)
  const truncatedQuestion = card?.question
    ? card.question.length > 100
      ? `${card.question.substring(0, 100)}...`
      : card.question
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Usuń fiszkę
          </DialogTitle>
          <DialogDescription>
            Czy na pewno chcesz usunąć tę fiszkę? Tej operacji nie można cofnąć.
          </DialogDescription>
        </DialogHeader>

        {/* Card Preview */}
        {card && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Pytanie:
            </div>
            <p className="text-sm">{truncatedQuestion}</p>
          </div>
        )}

        {/* Warning Message */}
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">
            Fiszka zostanie trwale usunięta wraz z całą historią nauki. Ta operacja jest nieodwracalna.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
          >
            Usuń fiszkę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


