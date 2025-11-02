/**
 * POST /api/v1/auth/sign-out
 *
 * Signs out the current user and clears session cookies.
 * Uses Supabase Auth to invalidate the session.
 *
 * Request Body: None
 *
 * Responses:
 * - 204 NO_CONTENT: Successfully signed out
 * - 500 INTERNAL_SERVER_ERROR: Server error
 */

import type { APIRoute } from "astro";
import { hasCookiesToSet } from "@/db/supabase.client";
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse } from "@/types";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  try {
    // Sign out from Supabase Auth
    const { error } = await locals.supabase.auth.signOut();

    if (error) {
      console.error("Sign-out error:", error);

      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: "Failed to sign out",
          },
        } satisfies ErrorResponse),
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // IMPORTANT: We need to manually add Set-Cookie headers to clear cookies
    // because Astro API routes don't automatically serialize cookie deletions
    const responseHeaders = new Headers();

    // Get cookies that were set/cleared by Supabase during signOut
    const cookiesToSet = hasCookiesToSet(locals.supabase) ? (locals.supabase.__cookiesToSet ?? []) : [];

    cookiesToSet.forEach(({ name, value, options }) => {
      // Serialize cookie with proper options (usually MaxAge=0 for deletion)
      let cookieString = `${name}=${value}`;
      if (options.path) cookieString += `; Path=${options.path}`;
      if (options.maxAge !== undefined) cookieString += `; Max-Age=${options.maxAge}`;
      if (options.httpOnly) cookieString += `; HttpOnly`;
      if (options.secure) cookieString += `; Secure`;
      if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;

      responseHeaders.append("Set-Cookie", cookieString);
    });

    // Success - return 204 No Content with cookie headers
    return new Response(null, {
      status: HttpStatus.NO_CONTENT,
      headers: responseHeaders,
    });
  } catch (err) {
    // Log error for debugging
    console.error("Unexpected sign-out error:", err);

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
