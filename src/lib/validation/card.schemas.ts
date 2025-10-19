import { z } from "zod";

/**
 * Validation schema for creating a new card
 * POST /api/v1/decks/{deckId}/cards
 */
export const createCardSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty")
    .max(10000, "Question cannot exceed 10,000 characters"),
  answer: z
    .string()
    .trim()
    .min(1, "Answer cannot be empty")
    .max(10000, "Answer cannot exceed 10,000 characters"),
});

/**
 * Validation schema for updating a card
 * PATCH /api/v1/cards/{cardId}
 */
export const updateCardSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty")
    .max(10000, "Question cannot exceed 10,000 characters")
    .optional(),
  answer: z
    .string()
    .trim()
    .min(1, "Answer cannot be empty")
    .max(10000, "Answer cannot exceed 10,000 characters")
    .optional(),
});

/**
 * Validation schema for deckId path parameter
 * Used in routes with {deckId}
 */
export const deckIdParamSchema = z.string().uuid("Invalid deck ID format");

/**
 * Validation schema for cardId path parameter
 * Used in routes with {cardId}
 */
export const cardIdParamSchema = z.string().uuid("Invalid card ID format");
