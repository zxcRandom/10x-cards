/**
 * POST /api/v1/auth/password/request-reset
 * Request OTP code for password reset via email.
 * US-014: Reset Password
 *
 * Request Body:
 * - email: string (required)
 *
 * Responses:
 * - 200 OK: OTP request processed (always success for security)
 * - 400 BAD_REQUEST: Validation error
 * - 429 TOO_MANY_REQUESTS: Rate limit exceeded
 * - 500 INTERNAL_SERVER_ERROR: Server error
 */

import type { APIRoute } from "astro";
import { passwordResetRequestSchema } from "@/lib/validation/auth.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { createAdminClient } from "@/db/supabase.client";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const runtimeEnv = locals.runtime?.env as Record<string, unknown> | undefined;
  const rateLimiter = new RateLimitService(
    createAdminClient(runtimeEnv),
    (runtimeEnv?.REDIS_URL as string) || import.meta.env.REDIS_URL
  );

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
    const validationResult = passwordResetRequestSchema.safeParse(body);
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

    const { email } = validationResult.data;

    // 3. Rate limiting - check BEFORE attempt
    const rateLimitCheck = await rateLimiter.checkPasswordResetRateLimit(email);
    if (!rateLimitCheck.allowed) {
      const retryAfterSeconds = rateLimitCheck.resetInMs ? Math.ceil(rateLimitCheck.resetInMs / 1000) : 60;

      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.TOO_MANY_REQUESTS,
            message: "Too many password reset attempts. Please try again later.",
            details: `Retry after ${retryAfterSeconds} seconds`,
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    // 4. Request OTP code from Supabase
    // Supabase sends 6-digit code via email, valid for 60 seconds
    const { error } = await locals.supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // Don't create user for password reset
      },
    });

    // 5. Increment rate limit AFTER attempt
    await rateLimiter.incrementPasswordResetRateLimit(email);

    // IMPORTANT: ALWAYS return success for security (neutral messaging)
    // Don't reveal whether email exists in the system
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[Auth] OTP request error:", error);
      // Still return success to user
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Jeśli podany adres e-mail istnieje, wysłaliśmy kod weryfikacyjny (6 cyfr)",
      }),
      { status: HttpStatus.OK, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Auth] OTP request error:", err);

    // Still return success for security
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Jeśli podany adres e-mail istnieje, wysłaliśmy kod weryfikacyjny (6 cyfr)",
      }),
      { status: HttpStatus.OK, headers: { "Content-Type": "application/json" } }
    );
  }
};
