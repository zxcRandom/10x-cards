import { z } from "zod";

/**
 * Schema walidacji dla PATCH /api/v1/profile
 * Validates user profile update requests
 */
export const UpdateProfileSchema = z
  .object({
    privacyConsent: z
      .boolean({
        invalid_type_error: "privacyConsent must be a boolean",
      })
      .optional(),

    restore: z
      .boolean({
        invalid_type_error: "restore must be a boolean",
      })
      .optional(),
  })
  .strict() // Don't allow additional fields
  .refine((data) => data.privacyConsent !== undefined || data.restore !== undefined, {
    message: "At least one field (privacyConsent or restore) must be provided",
  })
  .refine((data) => data.restore === undefined || data.restore === true, {
    message: "restore field can only be true (or omitted)",
    path: ["restore"],
  });

/**
 * Type inferred from schema
 */
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
