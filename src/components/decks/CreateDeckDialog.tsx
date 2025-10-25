/**
 * CreateDeckDialog Component
 * 
 * Modal for creating a new deck.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { DeckDTO } from '@/types';

interface CreateDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (created: DeckDTO) => void;
}

export default function CreateDeckDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDeckDialogProps) {
  const [name, setName] = useState('');
  const [createdByAi, setCreatedByAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('');
      setCreatedByAi(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nazwa talii jest wymagana');
      return;
    }
    if (trimmedName.length > 255) {
      setError('Nazwa talii nie może być dłuższa niż 255 znaków');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v1/decks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          createdByAi,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Twoja sesja wygasła. Zaloguj się ponownie.');
        }
        if (response.status === 400 || response.status === 422) {
          const errorData = await response.json();
          throw new Error(
            errorData.error?.message || 'Nieprawidłowe dane formularza'
          );
        }
        throw new Error('Wystąpił błąd podczas tworzenia talii');
      }

      const created = await response.json();
      
      // Reset form
      setName('');
      setCreatedByAi(false);
      setError('');
      
      onSuccess(created);
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
          <DialogTitle>Stwórz nową talię</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nazwa talii *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Angielski - Słownictwo"
                disabled={loading}
                required
                maxLength={255}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'name-error' : undefined}
              />
              {error && (
                <p id="name-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="createdByAi"
                checked={createdByAi}
                onCheckedChange={(checked) => setCreatedByAi(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="createdByAi" className="cursor-pointer">
                Talia stworzona przez AI
              </Label>
            </div>
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
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
