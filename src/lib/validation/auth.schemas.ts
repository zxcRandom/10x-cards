/**
 * Auth Validation Schemas
 * 
 * Zod schemas for validating authentication-related requests.
 * Used for both client-side and server-side validation.
 */

import { z } from "zod";

/**
 * Email validation schema
 */
const emailSchema = z
  .string()
  .min(1, "Adres e-mail jest wymagany")
  .email("Nieprawidłowy adres e-mail")
  .max(255, "Adres e-mail jest za długi");

/**
 * Password validation schema
 * Minimum 8 characters as per specification
 */
const passwordSchema = z
  .string()
  .min(8, "Hasło musi mieć co najmniej 8 znaków")
  .max(255, "Hasło jest za długie");

/**
 * Sign In Schema - POST /api/v1/auth/sign-in
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Sign Up Schema - POST /api/v1/auth/sign-up
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie są identyczne",
  path: ["confirmPassword"],
});

/**
 * Password Reset Request Schema - POST /api/v1/auth/password/request-reset
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password Reset Schema - POST /api/v1/auth/password/reset
 */
export const passwordResetSchema = z.object({
  newPassword: passwordSchema,
  confirmNewPassword: passwordSchema,
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Hasła nie są identyczne",
  path: ["confirmNewPassword"],
});

/**
 * OTP Password Reset Schema - POST /api/v1/auth/password/verify-and-reset
 * Validates OTP code + new password for OTP-based password reset flow
 */
export const otpPasswordResetSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .length(6, "Kod musi mieć 6 cyfr")
    .regex(/^\d+$/, "Kod musi zawierać tylko cyfry"),
  newPassword: passwordSchema,
  confirmNewPassword: passwordSchema,
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Hasła nie są identyczne",
  path: ["confirmNewPassword"],
});

/**
 * Change Password Schema - POST /api/v1/auth/password/change
 */
export const passwordChangeSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  confirmNewPassword: passwordSchema,
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Hasła nie są identyczne",
  path: ["confirmNewPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "Nowe hasło musi być inne niż obecne",
  path: ["newPassword"],
});

/**
 * Delete Account Schema - DELETE /api/v1/auth/account/delete
 */
export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .min(1, "Potwierdzenie jest wymagane")
    .refine((val) => val === "DELETE", {
      message: "Wpisz DELETE aby potwierdzić",
    }),
});

/**
 * Type exports for use in components
 */
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type OtpPasswordResetInput = z.infer<typeof otpPasswordResetSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
