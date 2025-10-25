/**
 * DeleteDeckDialog Component
 * 
 * Modal for confirming deck deletion with cascading warning.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { DeckDTO } from '@/types';

interface DeleteDeckDialogProps {
  open: boolean;
  deck: DeckDTO | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: (deletedId: string) => void;
}

export default function DeleteDeckDialog({
  open,
  deck,
  onOpenChange,
  onSuccess,
}: DeleteDeckDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setUnderstood(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deck || !understood) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/v1/decks/${deck.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Twoja sesja wygasła. Zaloguj się ponownie.');
        }
        if (response.status === 404) {
          throw new Error('Talia nie została znaleziona. Mogła już zostać usunięta.');
        }
        throw new Error('Wystąpił błąd podczas usuwania talii');
      }

      onSuccess(deck.id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Nieznany błąd';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuń talię</DialogTitle>
          <DialogDescription>
            Ta akcja jest nieodwracalna i spowoduje usunięcie talii oraz
            wszystkich fiszek w niej zawartych.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {deck && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{deck.name}</p>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Checkbox
                id="understood"
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="understood" className="cursor-pointer text-sm">
                Rozumiem konsekwencje i chcę trwale usunąć tę talię wraz ze
                wszystkimi fiszkami
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || !understood}
            >
              {loading ? 'Usuwanie...' : 'Usuń'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
