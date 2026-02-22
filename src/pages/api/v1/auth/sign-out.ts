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
import { HttpStatus, ErrorCode } from "@/types";
import type { ErrorResponse } from "@/types";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  try {
    // Sign out from Supabase Auth
    const { error } = await locals.supabase.auth.signOut();

    if (error) {
      // eslint-disable-next-line no-console
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

    // Success - return 204 No Content
    return new Response(null, {
      status: HttpStatus.NO_CONTENT,
    });
  } catch (err) {
    // Log error for debugging
    // eslint-disable-next-line no-console
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
