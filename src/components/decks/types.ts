/**
 * Decks View Models and Types
 *
 * Frontend-specific types for the Decks view components.
 * These types extend or complement the API DTOs from @/types.
 */

import type { DeckDTO } from "@/types";

/**
 * Sort field options for deck list
 */
export type SortField = "createdAt" | "updatedAt" | "name";

/**
 * Sort order options
 */
export type SortOrder = "asc" | "desc";

/**
 * Query parameters for deck list
 */
export interface DeckListQuery {
  limit: number;
  offset: number;
  sort: SortField;
  order: SortOrder;
  createdByAi?: boolean;
  q?: string;
}

/**
 * Pagination state
 */
export interface PaginationState {
  limit: number;
  offset: number;
  total: number;
}

/**
 * Sort state
 */
export interface SortState {
  field: SortField;
  order: SortOrder;
}

/**
 * View model for deck card (same as DTO for now)
 */
export type DeckCardViewModel = DeckDTO;

/**
 * State for decks list
 */
export type DecksListState = "idle" | "loading" | "error" | "success";
