/**
 * POST /api/v1/auth/sign-in
 *
 * Authenticates a user with email and password.
 * Uses Supabase Auth for authentication and sets session cookies.
 *
 * Request Body:
 * - email: string (required)
 * - password: string (required)
 *
 * Responses:
 * - 303 SEE_OTHER: Redirect to /decks with session cookies
 * - 400 BAD_REQUEST: Validation error
 * - 401 UNAUTHORIZED: Invalid credentials (neutral message)
 * - 429 TOO_MANY_REQUESTS: Rate limit exceeded
 * - 500 INTERNAL_SERVER_ERROR: Server error
 */

import type { APIRoute } from "astro";
import { signInSchema } from "@/lib/validation/auth.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { hasCookiesToSet } from "@/db/supabase.client";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

export const prerender = false;

const rateLimiter = new RateLimitService();

export const POST: APIRoute = async ({ request, locals }) => {
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
    const validationResult = signInSchema.safeParse(body);
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
    const rateLimitCheck = await rateLimiter.checkAuthSignInRateLimit(email);
    if (!rateLimitCheck.allowed) {
      const retryAfterSeconds = rateLimitCheck.resetInMs ? Math.ceil(rateLimitCheck.resetInMs / 1000) : 60;

      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.TOO_MANY_REQUESTS,
            message: "Too many login attempts. Please try again later.",
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

    // Attempt authentication with Supabase
    const { data, error } = await locals.supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Increment rate limit after attempt (whether successful or not)
    await rateLimiter.incrementAuthSignInRateLimit(email);

    if (error) {
      // Return neutral error message for security
      // Don't reveal whether email exists or password is wrong
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "Invalid email or password",
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.UNAUTHORIZED,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!data.user) {
      // Shouldn't happen, but handle edge case
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "Authentication failed",
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.UNAUTHORIZED,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // IMPORTANT: We need to manually add Set-Cookie headers from Supabase to the Response
    // because Astro API routes don't automatically serialize cookies
    const responseHeaders = new Headers();

    // Get cookies that were set by Supabase during signInWithPassword
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
    console.error("Sign-in error:", err);

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
