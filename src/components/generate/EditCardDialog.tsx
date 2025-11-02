import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EditCardForm, EditCardFormErrors } from "./types";

interface EditCardDialogProps {
  open: boolean;
  initialValue: EditCardForm;
  onClose: () => void;
  onSubmit: (question: string, answer: string) => void;
}

/**
 * EditCardDialog - Modal for editing a flashcard
 *
 * Allows editing question and answer with validation
 */
export function EditCardDialog({ open, initialValue, onClose, onSubmit }: EditCardDialogProps) {
  const [form, setForm] = useState<EditCardForm>(initialValue);
  const [errors, setErrors] = useState<EditCardFormErrors>({});

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm(initialValue);
      setErrors({});
    } else {
      onClose();
    }
  };

  // Validate and submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: EditCardFormErrors = {};

    if (form.question.trim().length === 0) {
      newErrors.question = "Pytanie nie może być puste";
    }

    if (form.answer.trim().length === 0) {
      newErrors.answer = "Odpowiedź nie może być pusta";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(form.question.trim(), form.answer.trim());
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edytuj fiszkę</DialogTitle>
            <DialogDescription>Wprowadź zmiany do pytania i odpowiedzi</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Question */}
            <div className="grid gap-2">
              <Label htmlFor="question">
                Pytanie <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="question"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Wprowadź pytanie"
                rows={3}
                aria-invalid={!!errors.question}
                aria-describedby={errors.question ? "question-error" : undefined}
              />
              {errors.question && (
                <p id="question-error" className="text-sm text-destructive">
                  {errors.question}
                </p>
              )}
            </div>

            {/* Answer */}
            <div className="grid gap-2">
              <Label htmlFor="answer">
                Odpowiedź <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="answer"
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="Wprowadź odpowiedź"
                rows={3}
                aria-invalid={!!errors.answer}
                aria-describedby={errors.answer ? "answer-error" : undefined}
              />
              {errors.answer && (
                <p id="answer-error" className="text-sm text-destructive">
                  {errors.answer}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit">Zapisz zmiany</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
