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

/**
 * Validation schema for GET /api/v1/decks query parameters
 * Validates pagination, sorting, and filtering options
 */
export const ListDecksQuerySchema = z.object({
  limit: z.coerce
    .number({
      invalid_type_error: "Limit must be a number",
    })
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),

  offset: z.coerce
    .number({
      invalid_type_error: "Offset must be a number",
    })
    .int("Offset must be an integer")
    .min(0, "Offset must be non-negative")
    .default(0),

  sort: z
    .enum(["createdAt", "updatedAt", "name"], {
      errorMap: () => ({
        message: "Sort must be one of: createdAt, updatedAt, name",
      }),
    })
    .default("createdAt"),

  order: z
    .enum(["asc", "desc"], {
      errorMap: () => ({ message: "Order must be either asc or desc" }),
    })
    .default("desc"),

  createdByAi: z.coerce
    .boolean({
      invalid_type_error: "createdByAi must be a boolean",
    })
    .optional(),

  q: z.string().trim().optional(),
});

/**
 * Type inferred from ListDecksQuerySchema
 */
export type ListDecksQueryInput = z.infer<typeof ListDecksQuerySchema>;
