/**
 * CardDialog Component
 * 
 * Modal dialog for creating and editing individual flashcards.
 * Handles form validation, API calls, and error states.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { createCardSchema, updateCardSchema, MAX_CARD_CONTENT_LENGTH } from '@/lib/validation/card.schemas';
import type { CardDTO } from '@/types';
import type { CardDialogMode } from './types';
import { z } from 'zod';

interface CardDialogProps {
  open: boolean;
  mode: CardDialogMode;
  card: CardDTO | null;
  deckId: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: (card: CardDTO) => void;
}

interface FormErrors {
  question?: string;
  answer?: string;
  _form?: string;
}

export default function CardDialog({
  open,
  mode,
  card,
  deckId,
  onOpenChange,
  onSuccess,
}: CardDialogProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when dialog opens/closes or card changes
  useEffect(() => {
    if (open && mode === 'edit' && card) {
      setQuestion(card.question);
      setAnswer(card.answer);
    } else if (open && mode === 'create') {
      setQuestion('');
      setAnswer('');
    }
    setErrors({});
  }, [open, mode, card]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    try {
      if (mode === 'create') {
        createCardSchema.parse({ question: question.trim(), answer: answer.trim() });
      } else {
        updateCardSchema.parse({ question: question.trim(), answer: answer.trim() });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          const field = err.path[0] as 'question' | 'answer';
          newErrors[field] = err.message;
        });
      }
      setErrors(newErrors);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let response: Response;

      if (mode === 'create') {
        // Create new card
        response = await fetch(`/api/v1/decks/${deckId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question.trim(),
            answer: answer.trim(),
          }),
        });
      } else {
        // Update existing card
        if (!card) {
          throw new Error('Card is required for edit mode');
        }
        response = await fetch(`/api/v1/cards/${card.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question.trim(),
            answer: answer.trim(),
          }),
        });
      }

      if (!response.ok) {
        // Handle HTTP errors
        if (response.status === 400 || response.status === 422) {
          const errorData = await response.json();
          setErrors({
            _form: errorData.error?.message || 'Błąd walidacji danych',
          });
        } else if (response.status === 401) {
          setErrors({
            _form: 'Twoja sesja wygasła. Zaloguj się ponownie.',
          });
        } else if (response.status === 403) {
          setErrors({
            _form: 'Nie masz uprawnień do tej operacji',
          });
        } else if (response.status === 404) {
          setErrors({
            _form: mode === 'edit' ? 'Karta nie została znaleziona' : 'Talia nie została znaleziona',
          });
        } else {
          setErrors({
            _form: 'Wystąpił błąd podczas zapisywania. Spróbuj ponownie.',
          });
        }
        return;
      }

      const savedCard: CardDTO = await response.json();
      onSuccess(savedCard);
    } catch (error) {
      console.error('Error saving card:', error);
      setErrors({
        _form: 'Wystąpił błąd podczas zapisywania. Sprawdź połączenie z internetem.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
    if (errors.question) {
      setErrors({ ...errors, question: undefined });
    }
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(e.target.value);
    if (errors.answer) {
      setErrors({ ...errors, answer: undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Dodaj nową fiszkę' : 'Edytuj fiszkę'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Wprowadź pytanie i odpowiedź dla nowej fiszki'
              : 'Zmień pytanie lub odpowiedź dla tej fiszki'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question Field */}
          <div className="space-y-2">
            <Label htmlFor="question">
              Pytanie
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              id="question"
              value={question}
              onChange={handleQuestionChange}
              disabled={loading}
              className="min-h-[100px] resize-y"
              placeholder="Wprowadź pytanie..."
              aria-invalid={!!errors.question}
              aria-describedby={errors.question ? 'question-error' : 'question-hint'}
            />
            <div className="flex items-center justify-between text-xs">
              <span id="question-hint" className="text-muted-foreground">
                Maksymalnie {MAX_CARD_CONTENT_LENGTH.toLocaleString()} znaków
              </span>
              <span
                className={
                  question.length > MAX_CARD_CONTENT_LENGTH
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }
              >
                {question.length.toLocaleString()} / {MAX_CARD_CONTENT_LENGTH.toLocaleString()}
              </span>
            </div>
            {errors.question && (
              <p id="question-error" className="text-xs text-destructive">
                {errors.question}
              </p>
            )}
          </div>

          {/* Answer Field */}
          <div className="space-y-2">
            <Label htmlFor="answer">
              Odpowiedź
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              id="answer"
              value={answer}
              onChange={handleAnswerChange}
              disabled={loading}
              className="min-h-[100px] resize-y"
              placeholder="Wprowadź odpowiedź..."
              aria-invalid={!!errors.answer}
              aria-describedby={errors.answer ? 'answer-error' : 'answer-hint'}
            />
            <div className="flex items-center justify-between text-xs">
              <span id="answer-hint" className="text-muted-foreground">
                Maksymalnie {MAX_CARD_CONTENT_LENGTH.toLocaleString()} znaków
              </span>
              <span
                className={
                  answer.length > MAX_CARD_CONTENT_LENGTH
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }
              >
                {answer.length.toLocaleString()} / {MAX_CARD_CONTENT_LENGTH.toLocaleString()}
              </span>
            </div>
            {errors.answer && (
              <p id="answer-error" className="text-xs text-destructive">
                {errors.answer}
              </p>
            )}
          </div>

          {/* Form-level Error */}
          {errors._form && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{errors._form}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Dodaj' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


