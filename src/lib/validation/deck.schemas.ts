import { z } from "zod";

/**
 * Validation schema for POST /api/v1/decks request body
 * Validates deck creation command
 */
export const CreateDeckSchema = z.object({
  name: z
    .string({
      required_error: "Deck name is required",
      invalid_type_error: "Deck name must be a string",
    })
    .trim()
    .min(1, "Deck name cannot be empty")
    .max(255, "Deck name must not exceed 255 characters"),

  createdByAi: z
    .boolean({
      invalid_type_error: "createdByAi must be a boolean",
    })
    .optional()
    .default(false),
});

/**
 * Type inferred from CreateDeckSchema
 */
export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;

/**
 * Validation schema for PATCH /api/v1/decks/{deckId} request body
 * Validates deck update command (partial update)
 */
export const UpdateDeckSchema = z
  .object({
    name: z
      .string({
        invalid_type_error: "Deck name must be a string",
      })
      .trim()
      .min(1, "Deck name cannot be empty")
      .max(255, "Deck name must not exceed 255 characters")
      .optional(),
  })
  .strict() // Don't allow additional fields
  .refine((data) => Object.keys(data).length > 0, {
    message: "Request body must contain at least one field to update",
  });

/**
 * Type inferred from UpdateDeckSchema
 */
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
