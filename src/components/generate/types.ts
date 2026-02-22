/**
 * Generate View Models and Types
 *
 * Frontend-specific types for the AI flashcard generation and review views.
 * These types extend or complement the API DTOs from @/types.
 */

/**
 * Review card view model
 * Extends CardDTO with UI-specific state for the review process
 */
export interface ReviewCardVM {
  // Card data
  id: string;
  question: string;
  answer: string;

  // UI state
  selected: boolean; // Whether card is selected for saving
  edited: boolean; // Whether card has been modified
  discarded: boolean; // Whether card was discarded (soft delete in UI)

  // Original values (for detecting changes)
  originalQuestion: string;
  originalAnswer: string;
}

/**
 * Deck destination mode - where to save reviewed cards
 */
export type DeckDestinationMode = "new" | "existing";

/**
 * Deck destination view model
 * Defines where reviewed cards should be saved
 */
export interface DeckDestinationVM {
  mode: DeckDestinationMode;
  newName: string; // Name for new deck (when mode = 'new')
  existingDeckId: string | null; // Selected deck ID (when mode = 'existing')
}

/**
 * Edit card form data
 * Used in EditCardDialog for editing a single card
 */
export interface EditCardForm {
  question: string;
  answer: string;
}

/**
 * Edit card form errors
 */
export interface EditCardFormErrors {
  question?: string;
  answer?: string;
}

/**
 * Review state for the entire view
 */
export type ReviewState = "idle" | "loading" | "saving" | "error";
