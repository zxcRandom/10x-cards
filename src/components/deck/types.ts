/**
 * Deck Details View Models and Types
 *
 * Frontend-specific types for the Deck Details view components.
 * These types extend or complement the API DTOs from @/types.
 */

import type { CardDTO, DeckDTO } from '@/types';

/**
 * Sort field options for cards list
 */
export type CardsSort =
  | 'createdAt'
  | 'updatedAt'
  | 'nextReviewDate'
  | 'easeFactor'
  | 'intervalDays'
  | 'repetitions'
  | 'question'
  | 'answer';

/**
 * Sort order options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Query parameters for cards list
 */
export interface CardsListQuery {
  limit: number;
  offset: number;
  sort: CardsSort;
  order: SortOrder;
  q?: string;
}

/**
 * Complete state for deck details view
 */
export interface DeckDetailsState {
  // Deck data
  deck: DeckDTO;
  
  // Cards list
  cards: CardDTO[];
  total: number;
  
  // Query parameters
  query: CardsListQuery;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Due cards count for "Study" button
  dueCount?: number;
}

/**
 * Card row view model for table display
 */
export interface CardRowVM {
  id: string;
  question: string;
  answer: string;
  nextReviewDate: string;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  updatedAt: string;
}

/**
 * Form values for card create/edit dialog
 */
export interface CardFormValues {
  question: string;
  answer: string;
}

/**
 * Card dialog mode
 */
export type CardDialogMode = 'create' | 'edit';

/**
 * Card dialog state
 */
export interface CardDialogState {
  open: boolean;
  mode: CardDialogMode;
  card: CardDTO | null;
}
