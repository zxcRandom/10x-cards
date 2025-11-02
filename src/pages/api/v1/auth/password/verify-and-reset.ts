/**
 * POST /api/v1/auth/password/verify-and-reset
 * Verify OTP code and reset password in one operation.
 * US-014: Reset Password
 *
 * Request Body:
 * - email: string (required)
 * - otp: string (required, 6 digits)
 * - newPassword: string (required, min 8 chars)
 * - confirmNewPassword: string (required, must match newPassword)
 *
 * Responses:
 * - 200 OK: Password reset successful
 * - 400 BAD_REQUEST: Validation error or invalid/expired OTP
 * - 500 INTERNAL_SERVER_ERROR: Server error
 */

import type { APIRoute } from "astro";
import { otpPasswordResetSchema } from "@/lib/validation/auth.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: "Invalid JSON in request body",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validate input
    const validationResult = otpPasswordResetSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
            errors: formatZodErrors(validationResult.error),
          },
        } satisfies ValidationErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email, otp, newPassword } = validationResult.data;

    // 3. Verify OTP code (this sets up session automatically)
    const { error: verifyError } = await locals.supabase.auth.verifyOtp({
      email: email,
      token: otp,
      type: "email",
    });

    if (verifyError) {
      // eslint-disable-next-line no-console
      console.error("[Auth] OTP verification error:", verifyError);
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: "Nieprawidłowy lub wygasły kod weryfikacyjny",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.BAD_REQUEST, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Update password (session is now active from verifyOtp)
    const { error: updateError } = await locals.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error("[Auth] Password update error:", updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: "Nie udało się zaktualizować hasła",
          },
        } satisfies ErrorResponse),
        { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Success
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Hasło zostało zmienione pomyślnie",
      }),
      { status: HttpStatus.OK, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Auth] Verify and reset error:", err);
    return new Response(
      JSON.stringify({
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: "Wystąpił nieoczekiwany błąd",
        },
      } satisfies ErrorResponse),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers: { "Content-Type": "application/json" } }
    );
  }
};
