import { z } from "zod";

/**
 * Query parameters schema for GET /api/v1/ai/logs
 */
export const GetAILogsQuerySchema = z.object({
  // Filter by specific deck
  deckId: z.string().uuid().optional(),

  // Date range filters (ISO 8601 format)
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),

  // Pagination
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .default("20"),
  offset: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(0))
    .default("0"),

  // Sorting
  sort: z.enum(["createdAt", "generatedCardsCount"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type GetAILogsQuery = z.infer<typeof GetAILogsQuerySchema>;
