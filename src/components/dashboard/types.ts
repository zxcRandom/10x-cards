/**
 * Dashboard View Models and Types
 *
 * Frontend-specific types for the Dashboard view components.
 * These types extend or complement the API DTOs from @/types.
 */

/**
 * State of AI generation process
 */
export type AIGeneratorState = 'idle' | 'loading' | 'success' | 'error' | 'cancelling';

/**
 * Form data for AI flashcard generator
 */
export interface AIGeneratorFormVM {
  inputText: string;
  deckName?: string;
  maxCards?: number;
}

/**
 * Form validation errors
 */
export interface AIGeneratorFormErrors {
  inputText?: string;
  deckName?: string;
  maxCards?: string;
}

/**
 * Complete state for AI generator component
 */
export interface AIGeneratorComponentState {
  form: AIGeneratorFormVM;
  errors: AIGeneratorFormErrors;
  state: AIGeneratorState;
  errorMessage?: string;
}

/**
 * Props for RecentDecksList component
 */
export interface RecentDecksListProps {
  limit?: number;
  sort?: 'updatedAt' | 'createdAt' | 'name';
  order?: 'desc' | 'asc';
}
