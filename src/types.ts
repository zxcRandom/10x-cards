/**
 * API Types - DTOs and Command Models
 *
 * This file contains Data Transfer Objects (DTOs) and Command Models for the REST API.
 * All types are derived from database entity types defined in src/db/database.types.ts
 * and follow the API specification defined in .ai/api-plan.md
 *
 * Naming conventions:
 * - DTOs: Response data structures (e.g., ProfileDTO, DeckDTO)
 * - Commands: Request data structures (e.g., CreateDeckCommand, UpdateProfileCommand)
 * - ListDTOs: Paginated list responses (e.g., DecksListDTO, CardsListDTO)
 */

import type { Tables } from "./db/database.types";

// =============================================================================
// HTTP Status Codes
// =============================================================================

/**
 * HTTP status codes used in API responses
 * Provides type-safe status code constants
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standard API error codes
 * Used in error responses for consistent error handling
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // Validation
  BAD_REQUEST = "BAD_REQUEST",
  VALIDATION_ERROR = "VALIDATION_ERROR",

  // Resources
  NOT_FOUND = "NOT_FOUND",
  PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND",
  DECK_NOT_FOUND = "DECK_NOT_FOUND",
  CARD_NOT_FOUND = "CARD_NOT_FOUND",

  // Business Logic
  CONFLICT = "CONFLICT",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",

  // Server
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",

  // Rate Limiting
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
}

// =============================================================================
// Error Response Types
// =============================================================================

/**
 * Single validation error (used in ValidationErrorResponse)
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Standard error response structure
 * Used for all error responses (400, 401, 403, 404, 500, etc.)
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Validation error response with field-level errors (400 Bad Request)
 * Used when request validation fails (Zod validation errors)
 */
export interface ValidationErrorResponse {
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    errors: ValidationError[];
  };
}

/**
 * Conflict error response (409 Conflict)
 * Used when operation conflicts with current resource state
 */
export interface ConflictErrorResponse {
  error: {
    code: "CONFLICT";
    message: string;
    details?: string;
  };
}

/**
 * Unprocessable entity error response (422 Unprocessable Entity)
 * Used when request is well-formed but semantically incorrect
 */
export interface UnprocessableErrorResponse {
  error: {
    code: "UNPROCESSABLE_ENTITY";
    message: string;
    details?: string;
  };
}

// =============================================================================
// Shared Types
// =============================================================================

/**
 * Standard paginated list response structure
 */
export interface PaginatedListDTO<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Standard deletion confirmation response
 */
export interface DeletedDTO {
  status: "deleted";
}

// =============================================================================
// Profile DTOs and Commands
// =============================================================================

/**
 * Profile DTO - GET /api/v1/profile
 * Based on Tables<'profiles'> with camelCase field names
 */
export interface ProfileDTO {
  id: string;
  privacyConsent: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update Profile Command - PATCH /api/v1/profile
 * Allows updating privacy consent or restoring soft-deleted profile
 */
export interface UpdateProfileCommand {
  privacyConsent?: boolean;
  restore?: boolean; // When true, sets deletedAt to null
}

/**
 * Profile Deleted DTO - DELETE /api/v1/profile
 * Response after soft-deleting a profile
 */
export interface ProfileDeletedDTO {
  status: "deleted";
  deletedAt: string;
}

// =============================================================================
// Deck DTOs and Commands
// =============================================================================

/**
 * Deck DTO - Single deck representation
 * Based on Tables<'decks'>, excludes user_id (security), uses camelCase
 */
export interface DeckDTO {
  id: string;
  name: string;
  createdByAi: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Decks List DTO - GET /api/v1/decks
 * Paginated list of decks owned by the authenticated user
 */
export type DecksListDTO = PaginatedListDTO<DeckDTO>;

/**
 * Create Deck Command - POST /api/v1/decks
 */
export interface CreateDeckCommand {
  name: string;
  createdByAi?: boolean;
}

/**
 * Update Deck Command - PATCH /api/v1/decks/{deckId}
 */
export interface UpdateDeckCommand {
  name?: string;
}

/**
 * Deck Deleted DTO - DELETE /api/v1/decks/{deckId}
 */
export type DeckDeletedDTO = DeletedDTO;

// =============================================================================
// Card DTOs and Commands
// =============================================================================

/**
 * Card DTO - Single flashcard representation
 * Based on Tables<'cards'> with camelCase field names
 * Includes all SM-2 spaced repetition fields
 */
export interface CardDTO {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cards List DTO - GET /api/v1/decks/{deckId}/cards
 * Paginated list of cards in a deck
 */
export type CardsListDTO = PaginatedListDTO<CardDTO>;

/**
 * Due Cards List DTO - GET /api/v1/decks/{deckId}/cards/due
 * Paginated list of cards due for review
 */
export type DueCardsListDTO = PaginatedListDTO<CardDTO>;

/**
 * Create Card Command - POST /api/v1/decks/{deckId}/cards
 */
export interface CreateCardCommand {
  question: string;
  answer: string;
}

/**
 * Update Card Command - PATCH /api/v1/cards/{cardId}
 * Only question and answer can be updated directly
 * SM-2 fields are managed via the review endpoint
 */
export interface UpdateCardCommand {
  question?: string;
  answer?: string;
}

/**
 * Card Deleted DTO - DELETE /api/v1/cards/{cardId}
 */
export type CardDeletedDTO = DeletedDTO;

// =============================================================================
// Review DTOs and Commands
// =============================================================================

/**
 * Valid review grades for SM-2 algorithm
 * 0 = Complete blackout
 * 1 = Incorrect, but remembered upon seeing answer
 * 2 = Incorrect, but easy to recall
 * 3 = Correct, but difficult
 * 4 = Correct, with hesitation
 * 5 = Perfect recall
 */
export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Review DTO - Single review representation
 * Based on Tables<'reviews'> with camelCase field names
 */
export interface ReviewDTO {
  id: string;
  cardId: string;
  userId: string;
  grade: ReviewGrade;
  reviewDate: string;
}

/**
 * Reviews List DTO - GET /api/v1/reviews
 * Paginated list of reviews for the authenticated user
 */
export type ReviewsListDTO = PaginatedListDTO<ReviewDTO>;

/**
 * Create Review Command - POST /api/v1/cards/{cardId}/review
 * Submits a review grade and optionally specifies review date
 */
export interface CreateReviewCommand {
  grade: ReviewGrade;
  reviewDate?: string; // ISO-8601; defaults to server now()
}

/**
 * Review Response DTO - POST /api/v1/cards/{cardId}/review
 * Returns updated card SM-2 fields and the created review record
 */
export interface ReviewResponseDTO {
  card: {
    id: string;
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
    nextReviewDate: string;
    updatedAt: string;
  };
  review: ReviewDTO;
}

// =============================================================================
// AI Generation DTOs and Commands
// =============================================================================

/**
 * AI Generation Log DTO - Single AI generation attempt
 * Based on Tables<'ai_generation_logs'>, excludes user_id
 */
export interface AILogDTO {
  id: string;
  deckId: string | null;
  inputTextLength: number;
  generatedCardsCount: number;
  errorMessage: string | null;
  createdAt: string;
}

/**
 * AI Logs List DTO - GET /api/v1/ai/logs
 * Paginated list of AI generation logs for the authenticated user
 */
export type AILogsListDTO = PaginatedListDTO<AILogDTO>;

/**
 * Create AI Deck Command - POST /api/v1/ai/decks/from-text
 * Generates a deck and flashcards from input text using AI
 */
export interface CreateAIDeckCommand {
  inputText: string;
  deckName?: string;
  maxCards?: number; // Default 20, max 100
}

/**
 * AI Deck Response DTO - POST /api/v1/ai/decks/from-text
 * Returns generated deck, cards, and generation log
 */
export interface AIDeckResponseDTO {
  deck: DeckDTO;
  cards: {
    id: string;
    question: string;
    answer: string;
  }[];
  log: AILogDTO;
}

// =============================================================================
// Health Check DTO
// =============================================================================

/**
 * Health DTO - GET /api/v1/health
 * System health check response
 */
export interface HealthDTO {
  status: "ok";
  time: string; // ISO-8601 timestamp
}

// =============================================================================
// Auth DTOs and Commands
// =============================================================================

/**
 * Sign In Command - POST /api/v1/auth/sign-in
 */
export interface SignInCommand {
  email: string;
  password: string;
}

/**
 * Sign Up Command - POST /api/v1/auth/sign-up
 */
export interface SignUpCommand {
  email: string;
  password: string;
}

/**
 * Password Reset Request Command - POST /api/v1/auth/password/request-reset
 */
export interface PasswordResetRequestCommand {
  email: string;
}

/**
 * Password Reset Command - POST /api/v1/auth/password/reset
 */
export interface PasswordResetCommand {
  newPassword: string;
}

/**
 * Change Password Command - POST /api/v1/auth/password/change
 */
export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/**
 * Delete Account Command - DELETE /api/v1/auth/account/delete
 */
export interface DeleteAccountCommand {
  confirm: string;
}

/**
 * Auth Success Response - POST /api/v1/auth/sign-in, sign-up
 */
export interface AuthSuccessDTO {
  status: "ok";
  redirect?: string; // Optional redirect URL after successful auth
}

// =============================================================================
// Utility Types for Entity Transformations
// =============================================================================

/**
 * Helper type to transform database row to DTO (snake_case to camelCase)
 * This is used internally for type safety when mapping database entities to DTOs
 */
export type DbProfile = Tables<"profiles">;
export type DbDeck = Tables<"decks">;
export type DbCard = Tables<"cards">;
export type DbReview = Tables<"reviews">;
export type DbAILog = Tables<"ai_generation_logs">;

// =============================================================================
// Internal Service Types (not exposed in API)
// =============================================================================

/**
 * Internal type for profile update operations (snake_case for DB)
 * Used in ProfileService.updateProfile() to prepare data for database update
 */
export interface UpdateProfileData {
  privacy_consent?: boolean;
  deleted_at?: string | null;
  updated_at?: string; // Automatically set by trigger, but included for completeness
}
