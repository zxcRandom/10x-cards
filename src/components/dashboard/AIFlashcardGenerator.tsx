/**
 * AIFlashcardGenerator Component
 *
 * Form for generating flashcards using AI.
 * Handles text input, validation, generation, and cancellation.
 */

import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useAIGeneration } from '@/components/hooks/useAIGeneration';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AIGeneratorFormVM, AIGeneratorFormErrors } from './types';

const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 20000;
const MIN_CARDS = 1;
const MAX_CARDS = 100;
const DEFAULT_MAX_CARDS = 20;

export function AIFlashcardGenerator() {
  const { generate, cancel, state, error } = useAIGeneration();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<AIGeneratorFormVM>({
    inputText: '',
    deckName: '',
    maxCards: DEFAULT_MAX_CARDS,
  });

  const [errors, setErrors] = useState<AIGeneratorFormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: AIGeneratorFormErrors = {};

    // Validate inputText
    const trimmedText = form.inputText.trim();
    if (!trimmedText) {
      newErrors.inputText = 'Tekst jest wymagany';
    } else if (trimmedText.length < MIN_TEXT_LENGTH || trimmedText.length > MAX_TEXT_LENGTH) {
      newErrors.inputText = `Tekst musi mieć od ${MIN_TEXT_LENGTH} do ${MAX_TEXT_LENGTH} znaków`;
    }

    // Validate deckName (optional, but if provided must not be empty)
    if (form.deckName && form.deckName.trim().length === 0) {
      newErrors.deckName = 'Nazwa talii nie może być pusta';
    }

    // Validate maxCards
    if (form.maxCards !== undefined) {
      if (form.maxCards < MIN_CARDS || form.maxCards > MAX_CARDS) {
        newErrors.maxCards = `Liczba kart musi być od ${MIN_CARDS} do ${MAX_CARDS}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Prepare command
    const command = {
      inputText: form.inputText.trim(),
      ...(form.deckName?.trim() && { deckName: form.deckName.trim() }),
      ...(form.maxCards && { maxCards: form.maxCards }),
    };

    const result = await generate(command);

    if (result) {
      // Success
      const cardsCount = result.cards.length;
      toast.success(
        `Wygenerowano ${cardsCount} ${cardsCount === 1 ? 'fiszkę' : 'fiszek'} w talii "${result.deck.name}"`,
        {
          action: {
            label: 'Otwórz',
            onClick: () => {
              window.location.href = `/decks/${result.deck.id}`;
            },
          },
        }
      );

      // Reset form
      setForm({
        inputText: '',
        deckName: '',
        maxCards: DEFAULT_MAX_CARDS,
      });
      setErrors({});
    }
  };

  const handleCancel = () => {
    cancel();
    toast.info('Generowanie anulowane');
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, inputText: e.target.value });
    if (errors.inputText) {
      setErrors({ ...errors, inputText: undefined });
    }
  };

  const handleDeckNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, deckName: e.target.value });
    if (errors.deckName) {
      setErrors({ ...errors, deckName: undefined });
    }
  };

  const handleMaxCardsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
    setForm({ ...form, maxCards: value });
    if (errors.maxCards) {
      setErrors({ ...errors, maxCards: undefined });
    }
  };

  const isLoading = state === 'loading';
  const charCount = form.inputText.length;
  const charCountColor = charCount > MAX_TEXT_LENGTH ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Generuj fiszki AI
        </CardTitle>
        <CardDescription>
          Wklej tekst, a AI automatycznie utworzy dla Ciebie fiszki
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Text */}
          <div className="space-y-2">
            <Label htmlFor="input-text">
              Tekst do przetworzenia
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              ref={textareaRef}
              id="input-text"
              placeholder="Wklej tutaj tekst z którego AI wygeneruje fiszki..."
              value={form.inputText}
              onChange={handleTextChange}
              disabled={isLoading}
              className="min-h-[200px] resize-y"
              aria-invalid={!!errors.inputText}
              aria-describedby={errors.inputText ? 'input-text-error' : 'input-text-hint'}
            />
            <div className="flex items-center justify-between text-xs">
              <span id="input-text-hint" className="text-muted-foreground">
                Wprowadź od {MIN_TEXT_LENGTH} do {MAX_TEXT_LENGTH.toLocaleString()} znaków
              </span>
              <span className={charCountColor}>
                {charCount.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
              </span>
            </div>
            {errors.inputText && (
              <p id="input-text-error" className="text-xs text-destructive">
                {errors.inputText}
              </p>
            )}
            {/* Privacy Notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <svg 
                className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <p className="text-xs text-amber-900 dark:text-amber-100">
                Treść jest wysyłana do dostawcy AI w celu przetworzenia.{' '}
                <a 
                  href="/privacy-policy" 
                  className="underline hover:no-underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Polityka prywatności
                </a>
              </p>
            </div>
          </div>

          {/* Deck Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="deck-name">Nazwa talii (opcjonalnie)</Label>
            <Input
              id="deck-name"
              type="text"
              placeholder="np. Historia Polski"
              value={form.deckName}
              onChange={handleDeckNameChange}
              disabled={isLoading}
              aria-invalid={!!errors.deckName}
              aria-describedby={errors.deckName ? 'deck-name-error' : undefined}
            />
            {errors.deckName && (
              <p id="deck-name-error" className="text-xs text-destructive">
                {errors.deckName}
              </p>
            )}
          </div>

          {/* Max Cards */}
          <div className="space-y-2">
            <Label htmlFor="max-cards">Maksymalna liczba kart</Label>
            <Input
              id="max-cards"
              type="number"
              min={MIN_CARDS}
              max={MAX_CARDS}
              value={form.maxCards ?? ''}
              onChange={handleMaxCardsChange}
              disabled={isLoading}
              aria-invalid={!!errors.maxCards}
              aria-describedby={errors.maxCards ? 'max-cards-error' : 'max-cards-hint'}
            />
            <p id="max-cards-hint" className="text-xs text-muted-foreground">
              Od {MIN_CARDS} do {MAX_CARDS} kart (domyślnie {DEFAULT_MAX_CARDS})
            </p>
            {errors.maxCards && (
              <p id="max-cards-error" className="text-xs text-destructive">
                {errors.maxCards}
              </p>
            )}
          </div>

          {/* Error message from API */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit/Cancel Button */}
          <div className="flex gap-2">
            {isLoading ? (
              <Button
                type="button"
                onClick={handleCancel}
                variant="outline"
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Anuluj
              </Button>
            ) : (
              <Button type="submit" className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Generuj
              </Button>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generowanie fiszek...</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
