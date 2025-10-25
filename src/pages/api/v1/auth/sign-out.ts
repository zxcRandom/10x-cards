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

export const POST: APIRoute = async ({ locals, cookies }) => {
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

    // DEBUG: Log sign-out
    console.log(`[SIGN-OUT] User signed out`);

    // IMPORTANT: We need to manually add Set-Cookie headers to clear cookies
    // because Astro API routes don't automatically serialize cookie deletions
    const responseHeaders = new Headers();
    
    // Get cookies that were set/cleared by Supabase during signOut
    const cookiesToSet = (locals.supabase as any).__cookiesToSet || [];
    console.log(`[SIGN-OUT] Adding ${cookiesToSet.length} Set-Cookie headers to response`);
    
    cookiesToSet.forEach(({ name, value, options }: any) => {
      // Serialize cookie with proper options (usually MaxAge=0 for deletion)
      let cookieString = `${name}=${value}`;
      if (options.path) cookieString += `; Path=${options.path}`;
      if (options.maxAge !== undefined) cookieString += `; Max-Age=${options.maxAge}`;
      if (options.httpOnly) cookieString += `; HttpOnly`;
      if (options.secure) cookieString += `; Secure`;
      if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
      
      console.log(`[SIGN-OUT] Cookie: ${name} (MaxAge=${options.maxAge})`);
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
