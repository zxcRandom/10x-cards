import { z } from "zod";

/**
 * Validation schema for POST /api/v1/cards/{cardId}/review
 *
 * Validates review submission with grade (0-5) and optional review date
 */
export const CreateReviewSchema = z.object({
  grade: z
    .number()
    .int("Grade must be an integer")
    .min(0, "Grade must be between 0 and 5")
    .max(5, "Grade must be between 0 and 5"),
  reviewDate: z.string().datetime("Invalid ISO-8601 date format").optional(),
});

/**
 * Validation schema for cardId path parameter
 */
export const CardIdSchema = z.string().uuid("Invalid card ID format");
