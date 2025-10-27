import { z } from "zod";

/**
 * Maximum length for card question and answer fields
 */
export const MAX_CARD_CONTENT_LENGTH = 10000;

/**
 * Validation schema for creating a new card
 * POST /api/v1/decks/{deckId}/cards
 */
export const createCardSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty")
    .max(MAX_CARD_CONTENT_LENGTH, `Question cannot exceed ${MAX_CARD_CONTENT_LENGTH} characters`),
  answer: z
    .string()
    .trim()
    .min(1, "Answer cannot be empty")
    .max(MAX_CARD_CONTENT_LENGTH, `Answer cannot exceed ${MAX_CARD_CONTENT_LENGTH} characters`),
});

/**
 * Validation schema for updating a card
 * PATCH /api/v1/cards/{cardId}
 * At least one field (question or answer) must be provided
 */
export const updateCardSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(1, "Question cannot be empty")
      .max(MAX_CARD_CONTENT_LENGTH, `Question cannot exceed ${MAX_CARD_CONTENT_LENGTH} characters`)
      .optional(),
    answer: z
      .string()
      .trim()
      .min(1, "Answer cannot be empty")
      .max(MAX_CARD_CONTENT_LENGTH, `Answer cannot exceed ${MAX_CARD_CONTENT_LENGTH} characters`)
      .optional(),
  })
  .refine((data) => data.question !== undefined || data.answer !== undefined, {
    message: "At least one field (question or answer) must be provided",
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
