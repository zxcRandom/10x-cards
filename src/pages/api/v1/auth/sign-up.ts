/**
 * POST /api/v1/auth/sign-up
 *
 * Registers a new user with email and password.
 * Uses Supabase Auth for registration with auto-login (MVP).
 *
 * Request Body:
 * - email: string (required)
 * - password: string (required)
 * - confirmPassword: string (required)
 *
 * Responses:
 * - 201 CREATED: { status: "ok" }
 * - 400 BAD_REQUEST: Validation error
 * - 409 CONFLICT: Email already exists (neutral message)
 * - 429 TOO_MANY_REQUESTS: Rate limit exceeded
 * - 500 INTERNAL_SERVER_ERROR: Server error
 */

import type { APIRoute } from "astro";
import { signUpSchema } from "@/lib/validation/auth.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { hasCookiesToSet } from "@/db/supabase.client";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const rateLimiter = new RateLimitService(locals.runtime?.env?.REDIS_URL as string | undefined);

  try {
    // Parse request body
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
        {
          status: HttpStatus.BAD_REQUEST,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate input with Zod
    const validationResult = signUpSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
            errors: formatZodErrors(validationResult.error),
          },
        } satisfies ValidationErrorResponse),
        {
          status: HttpStatus.BAD_REQUEST,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { email, password } = validationResult.data;

    // Rate limiting - use email as identifier
    const rateLimitCheck = await rateLimiter.checkAuthSignUpRateLimit(email);
    if (!rateLimitCheck.allowed) {
      const retryAfterSeconds = rateLimitCheck.resetInMs ? Math.ceil(rateLimitCheck.resetInMs / 1000) : 60;

      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.TOO_MANY_REQUESTS,
            message: "Too many registration attempts. Please try again later.",
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

    // Attempt registration with Supabase
    const { data, error } = await locals.supabase.auth.signUp({
      email,
      password,
    });

    // Increment rate limit after attempt
    await rateLimiter.incrementAuthSignUpRateLimit(email);

    if (error) {
      // Check if it's a user already exists error
      if (error.message?.toLowerCase().includes("already") || error.status === 422) {
        // Return neutral message (don't reveal if email exists)
        return new Response(
          JSON.stringify({
            error: {
              code: ErrorCode.CONFLICT,
              message: "Unable to create account. Please try a different email or contact support.",
            },
          } satisfies ErrorResponse),
          {
            status: HttpStatus.CONFLICT,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Generic error
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: "Registration failed. Please check your details and try again.",
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.BAD_REQUEST,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: "Registration failed unexpectedly",
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // IMPORTANT: We need to manually add Set-Cookie headers from Supabase to the Response
    // because Astro API routes don't automatically serialize cookies
    const responseHeaders = new Headers();

    // Get cookies that were set by Supabase during signUp
    const cookiesToSet = hasCookiesToSet(locals.supabase) ? (locals.supabase.__cookiesToSet ?? []) : [];

    cookiesToSet.forEach(({ name, value, options }) => {
      // Serialize cookie with proper options
      let cookieString = `${name}=${value}`;
      if (options.path) cookieString += `; Path=${options.path}`;
      if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
      if (options.httpOnly) cookieString += `; HttpOnly`;
      if (options.secure) cookieString += `; Secure`;
      if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;

      responseHeaders.append("Set-Cookie", cookieString);
    });

    // Success - redirect to dashboard
    responseHeaders.set("Location", "/");

    return new Response(null, {
      status: 303, // See Other - redirect after POST
      headers: responseHeaders,
    });
  } catch (err) {
    // Log error for debugging (don't expose to client)
    // eslint-disable-next-line no-console
    console.error("Sign-up error:", err);

    return new Response(
      JSON.stringify({
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: "An unexpected error occurred",
        },
      } satisfies ErrorResponse),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
