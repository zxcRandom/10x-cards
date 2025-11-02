/**
 * DeckHeader Component
 *
 * Displays deck name and action buttons (Study, Rename, Delete).
 * Handles rename and delete operations with appropriate dialogs.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { DeckDTO } from "@/types";

interface DeckHeaderProps {
  deck: DeckDTO;
  onDeckUpdated: (updated: DeckDTO) => void;
  onDeckDeleted: () => void;
  canStudy?: boolean;
  dueCount?: number;
}

export default function DeckHeader({ deck, onDeckUpdated, onDeckDeleted, canStudy = true, dueCount }: DeckHeaderProps) {
  // Rename dialog state
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Initialize rename form when dialog opens
  useEffect(() => {
    if (renameOpen) {
      setNewName(deck.name);
      setRenameError("");
    }
  }, [renameOpen, deck.name]);

  const handleStudyClick = () => {
    if (!canStudy) {
      toast.info("Brak kart do powtórki w tej chwili");
      return;
    }

    window.location.href = `/decks/${deck.id}/study`;
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setRenameError("");

    // Validation
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setRenameError("Nazwa talii jest wymagana");
      return;
    }
    if (trimmedName.length > 255) {
      setRenameError("Nazwa talii nie może być dłuższa niż 255 znaków");
      return;
    }

    // No changes made
    if (trimmedName === deck.name) {
      setRenameOpen(false);
      return;
    }

    setRenameLoading(true);

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

      const updated: DeckDTO = await response.json();

      toast.success("Nazwa talii została zmieniona");
      setRenameOpen(false);
      onDeckUpdated(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Nieznany błąd";
      setRenameError(errorMessage);
    } finally {
      setRenameLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/v1/decks/${deck.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Twoja sesja wygasła. Zaloguj się ponownie.");
        }
        if (response.status === 404) {
          throw new Error("Talia nie została znaleziona. Mogła zostać usunięta.");
        }
        throw new Error("Wystąpił błąd podczas usuwania talii");
      }

      toast.success("Talia została usunięta");

      // Redirect to decks list
      setTimeout(() => {
        window.location.href = "/decks";
      }, 500);

      onDeckDeleted();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Nieznany błąd";
      toast.error(errorMessage);
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{deck.name}</h1>
          {deck.createdByAi && <p className="text-sm text-muted-foreground mt-1">Wygenerowano przez AI</p>}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleStudyClick} disabled={!canStudy} size="default">
            Ucz się
            {dueCount !== undefined && dueCount > 0 && (
              <span className="ml-2 bg-primary-foreground text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                {dueCount}
              </span>
            )}
          </Button>

          <Button variant="outline" onClick={() => setRenameOpen(true)}>
            Zmień nazwę
          </Button>

          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Usuń talię
          </Button>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zmień nazwę talii</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rename-name">Nazwa talii *</Label>
                <Input
                  id="rename-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="np. Angielski - Słownictwo"
                  disabled={renameLoading}
                  required
                  maxLength={255}
                  aria-invalid={renameError ? "true" : "false"}
                  aria-describedby={renameError ? "rename-name-error" : undefined}
                />
                {renameError && (
                  <p id="rename-name-error" className="text-sm text-destructive">
                    {renameError}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renameLoading}>
                Anuluj
              </Button>
              <Button type="submit" disabled={renameLoading || !newName.trim() || newName.trim() === deck.name}>
                {renameLoading ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń talię?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć talię <strong>{deck.name}</strong>?
              <br />
              Wszystkie fiszki w tej talii również zostaną usunięte.
              <br />
              <strong>Tej operacji nie można cofnąć.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              Anuluj
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? "Usuwanie..." : "Usuń talię"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
