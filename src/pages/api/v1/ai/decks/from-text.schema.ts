import { z } from 'zod';

/**
 * Validation schema for POST /api/v1/ai/decks/from-text
 * Validates input text, optional deck name, and max cards limit
 */
export const createAIDeckSchema = z.object({
  inputText: z
    .string()
    .trim()
    .min(1, 'Input text is required')
    .max(20000, 'Input text must not exceed 20,000 characters'),

  deckName: z
    .string()
    .trim()
    .min(1, 'Deck name must not be empty')
    .max(255, 'Deck name must not exceed 255 characters')
    .optional(),

  maxCards: z
    .number()
    .int('Max cards must be an integer')
    .min(1, 'Max cards must be at least 1')
    .max(100, 'Max cards must not exceed 100')
    .default(20),
});

export type CreateAIDeckInput = z.infer<typeof createAIDeckSchema>;

