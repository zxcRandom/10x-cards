import type { APIRoute } from "astro";

import { ConflictError, ProfileService, UnprocessableError } from "@/lib/services/profile.service";
import { UpdateProfileSchema } from "@/lib/validation/profile.schemas";
import { formatZodErrors } from "@/lib/utils/zod-errors";
import type { ErrorCode, ErrorResponse, HttpStatus, ProfileDTO, ProfileDeletedDTO } from "@/types";

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

/**
 * PATCH /api/v1/profile
 *
 * Updates the profile of the authenticated user.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - Partial update (only provided fields are updated)
 * - Supports updating privacy consent and restoring soft-deleted profiles
 * - Validates business logic (e.g., cannot restore active profile)
 * - User ID is extracted from verified JWT token (never from request params)
 *
 * @body {UpdateProfileCommand} Request body with optional fields
 * @returns {ProfileDTO} 200 OK - Profile updated successfully
 * @returns {ValidationErrorResponse} 400 Bad Request - Invalid request body or validation error
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 404 Not Found - Profile not found
 * @returns {ErrorResponse} 409 Conflict - Cannot restore profile that is not deleted
 * @returns {ErrorResponse} 422 Unprocessable Entity - Cannot update deleted profile without restore
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    // Step 1: Authentication check
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      console.error("[PATCH /api/v1/profile] Authentication failed:", {
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
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 2: Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      console.warn("[PATCH /api/v1/profile] Invalid JSON in request body:", {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: {
          code: "BAD_REQUEST" as ErrorCode,
          message: "Invalid JSON in request body",
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400 as HttpStatus,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 3: Validate with Zod
    const validationResult = UpdateProfileSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = formatZodErrors(validationResult.error);

      console.warn("[PATCH /api/v1/profile] Validation failed:", {
        errors,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            errors,
          },
        }),
        {
          status: 400 as HttpStatus,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Execute update through service
    const updatedProfile = await ProfileService.updateProfile(user.id, validationResult.data, locals.supabase);

    // Step 5: Log success (optional, for audit)
    console.info("[PATCH /api/v1/profile] Profile updated:", {
      userId: user.id,
      changes: validationResult.data,
      timestamp: new Date().toISOString(),
    });

    // Step 6: Success - return updated profile
    const successResponse: ProfileDTO = updatedProfile;

    return new Response(JSON.stringify(successResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Handle business logic errors
    if (error instanceof ConflictError) {
      console.warn("[PATCH /api/v1/profile] Conflict error:", {
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "CONFLICT",
            message: error.message,
            details: error.details,
          },
        }),
        {
          status: 409 as HttpStatus,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (error instanceof UnprocessableError) {
      console.warn("[PATCH /api/v1/profile] Unprocessable entity:", {
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: {
            code: "UNPROCESSABLE_ENTITY",
            message: error.message,
            details: error.details,
          },
        }),
        {
          status: 422 as HttpStatus,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle "Profile not found" error
    if (error instanceof Error && error.message === "Profile not found") {
      console.error("[PATCH /api/v1/profile] Profile not found:", {
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
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle unexpected errors
    console.error("[PATCH /api/v1/profile] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    const errorResponse: ErrorResponse = {
      error: {
        code: "INTERNAL_SERVER_ERROR" as ErrorCode,
        message: "An unexpected error occurred. Please try again later.",
        ...(import.meta.env.DEV && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500 as HttpStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * DELETE /api/v1/profile
 *
 * Soft deletes the profile of the authenticated user.
 *
 * Features:
 * - Requires authentication (Supabase JWT token)
 * - Soft delete: sets deleted_at timestamp, doesn't physically remove data
 * - Idempotent: multiple calls return success (true REST semantics)
 * - User can only delete their own profile (authorization enforced)
 * - Profile can be restored later with PATCH /api/v1/profile {restore: true}
 * - Historical data (decks, cards, reviews) is preserved for data integrity
 *
 * @returns {ProfileDeletedDTO} 200 OK - Profile soft deleted successfully
 * @returns {ErrorResponse} 401 Unauthorized - Missing or invalid authentication token
 * @returns {ErrorResponse} 404 Not Found - Profile not found
 * @returns {ErrorResponse} 500 Internal Server Error - Database error or unexpected exception
 */
export const DELETE: APIRoute = async ({ locals }) => {
  try {
    // Step 1: Authentication check (double-check after middleware)
    // Get user from Supabase auth using the JWT token
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    // If authentication failed or user doesn't exist, return 401 Unauthorized
    if (authError || !user) {
      console.error("[DELETE /api/v1/profile] Authentication failed:", {
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

    // Step 2: Execute soft delete through service
    // User ID comes from verified JWT token (secure - cannot be manipulated)
    const deleteResult = await ProfileService.deleteProfile(user.id, locals.supabase);

    // Step 3: Log success (optional, for audit)
    console.info("[DELETE /api/v1/profile] Profile deleted:", {
      userId: user.id,
      deletedAt: deleteResult.deletedAt,
      timestamp: new Date().toISOString(),
    });

    // Step 4: Success - return deletion confirmation
    const successResponse: ProfileDeletedDTO = deleteResult;

    return new Response(JSON.stringify(successResponse), {
      status: 200 as HttpStatus,
      headers: {
        "Content-Type": "application/json",
        // No caching for deletion confirmations
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    // Handle profile not found (should be rare - indicates data integrity issue)
    if (error instanceof Error && error.message === "Profile not found") {
      console.error("[DELETE /api/v1/profile] Profile not found for user:", {
        error: error.message,
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

    // Handle unexpected errors (database errors, exceptions)
    console.error("[DELETE /api/v1/profile] Unexpected error:", {
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
