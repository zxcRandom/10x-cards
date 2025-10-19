import type { APIRoute } from "astro";

import { ProfileService } from "@/lib/services/profile.service";
import type { ErrorCode, ErrorResponse, HttpStatus, ProfileDTO } from "@/types";

/**
 * GET /api/v1/profile
 *
 * Retrieves the profile of the authenticated user.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - User can only access their own profile (authorization enforced)
 * - Returns profile data with privacy consent and soft delete status
 * - User ID is extracted from verified JWT token (never from request params)
 *
 * @returns {ProfileDTO} 200 OK - Profile data retrieved successfully
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 404 Not Found - Profile not found (should not happen normally)
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Step 1: Authentication check (double-check after middleware)
    // Get user from Supabase auth using the JWT token
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    // If authentication failed or user doesn't exist, return 401 Unauthorized
    if (authError || !user) {
      console.error("[GET /api/v1/profile] Authentication failed:", {
        error: authError?.message,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "UNAUTHORIZED" as ErrorCode,
          message: "Authentication required. Please provide a valid access token.",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401 as HttpStatus,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // Step 2: Retrieve user profile from database
    // User ID comes from verified JWT token (secure - cannot be manipulated)
    const profile = await ProfileService.getProfile(user.id, locals.supabase);

    // Step 3: Handle profile not found (should be rare - indicates data integrity issue)
    if (!profile) {
      // Profile should exist for every user (created by trigger on signup)
      // If missing, this indicates a problem that requires investigation
      console.error("[GET /api/v1/profile] Profile not found for user:", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "PROFILE_NOT_FOUND" as ErrorCode,
          message: "User profile not found. Please contact support if this issue persists.",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404 as HttpStatus,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // Step 4: Success - return profile data
    const successResponse: ProfileDTO = profile;

    return new Response(JSON.stringify(successResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        // No caching for profile data - may change frequently
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Step 5: Handle unexpected errors (database errors, exceptions)
    console.error("[GET /api/v1/profile] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR" as ErrorCode,
        message: "An unexpected error occurred. Please try again later.",
        // Include details only in development mode for debugging
        ...(import.meta.env.DEV && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};

// Disable prerendering - this is a dynamic API route
export const prerender = false;
