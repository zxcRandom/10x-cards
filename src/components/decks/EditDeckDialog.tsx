/**
 * EditDeckDialog Component
 *
 * Modal for editing deck name.
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeckDTO } from "@/types";

interface EditDeckDialogProps {
  open: boolean;
  deck: DeckDTO | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: DeckDTO) => void;
}

export default function EditDeckDialog({ open, deck, onOpenChange, onSuccess }: EditDeckDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (deck) {
      setName(deck.name);
      setError("");
    }
  }, [deck]);

  useEffect(() => {
    if (!open) {
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deck) return;

    setError("");

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nazwa talii jest wymagana");
      return;
    }
    if (trimmedName.length > 255) {
      setError("Nazwa talii nie może być dłuższa niż 255 znaków");
      return;
    }

    // No changes made
    if (trimmedName === deck.name) {
      onOpenChange(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/v1/decks/${deck.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Twoja sesja wygasła. Zaloguj się ponownie.");
        }
        if (response.status === 404) {
          throw new Error("Talia nie została znaleziona. Mogła zostać usunięta.");
        }
        if (response.status === 400 || response.status === 422) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Nieprawidłowe dane formularza");
        }
        throw new Error("Wystąpił błąd podczas aktualizacji talii");
      }

      const updated = await response.json();

      setError("");
      onSuccess(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Nieznany błąd";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj talię</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nazwa talii *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Angielski - Słownictwo"
                disabled={loading}
                required
                maxLength={255}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "edit-name-error" : undefined}
              />
              {error && (
                <p id="edit-name-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || (deck !== null && name.trim() === deck.name)}>
              {loading ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
