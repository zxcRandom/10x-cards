import type { ZodError } from "zod";
import type { ValidationError } from "@/types";

/**
 * Formats Zod validation errors into a friendly API response format
 * @param zodError - Error object from Zod validation
 * @returns Array of validation errors with field names and messages
 */
export function formatZodErrors(zodError: ZodError): ValidationError[] {
  return zodError.errors.map((err) => ({
    field: err.path.length > 0 ? err.path.join(".") : "_root",
    message: err.message,
  }));
}
