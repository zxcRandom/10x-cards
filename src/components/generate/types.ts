/**
 * Generate View Models and Types
 *
 * Frontend-specific types for the AI flashcard generation and review views.
 * These types extend or complement the API DTOs from @/types.
 */

import type { DeckDTO, CardDTO, AIDeckResponseDTO } from "@/types";

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
export type DeckDestinationMode = 'new' | 'existing';

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
 * Save plan - describes what will happen on save
 * Used for validation and preview before executing save
 */
export interface SavePlan {
  mode: DeckDestinationMode;
  targetDeckId: string | null; // Deck where cards will be saved
  targetDeckName: string; // Name of target deck
  cardsToSave: ReviewCardVM[]; // Cards that will be saved
  cardsToUpdate: ReviewCardVM[]; // Cards that need PATCH (edited)
  cardsToDelete: ReviewCardVM[]; // Cards to delete (not selected)
  cardsToCreate: ReviewCardVM[]; // Cards to create in existing deck
  deckNameChanged: boolean; // Whether source deck name will be updated
  willDeleteSourceDeck: boolean; // Whether source deck will be deleted (if emptied)
}

/**
 * Review state for the entire view
 */
export type ReviewState = 'idle' | 'loading' | 'saving' | 'error';

/**
 * Complete component state for ReviewAICardsView
 */
export interface ReviewComponentState {
  // Data
  sourceDeckId: string; // Original deck created by AI
  sourceDeckName: string; // Original deck name
  cards: ReviewCardVM[]; // All cards being reviewed
  
  // Destination
  destination: DeckDestinationVM;
  
  // Available decks for selection
  availableDecks: DeckDTO[];
  availableDecksLoading: boolean;
  
  // UI state
  state: ReviewState;
  errorMessage?: string;
  
  // Dirty tracking
  hasUnsavedChanges: boolean;
}

/**
 * Initial data for review view
 * Can come from navigation state or API fetch
 */
export interface ReviewInitialData {
  deck: DeckDTO;
  cards: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}
