/**
 * POST /api/v1/auth/password/change
 * Change password for authenticated user
 *
 * Requires current password verification.
 * US-003: Change Password
 */

import type { APIRoute } from "astro";
import { passwordChangeSchema } from "@/lib/validation/auth.schemas";
import type { ErrorResponse, ValidationErrorResponse } from "@/types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        } satisfies ErrorResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "BAD_REQUEST",
            message: "Invalid JSON in request body",
          },
        } satisfies ErrorResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validation = passwordChangeSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            errors: validation.error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
        } satisfies ValidationErrorResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // 3. Verify current password by attempting sign-in
    const { error: signInError } = await locals.supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Current password is incorrect",
          },
        } satisfies ErrorResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. Update password
    const { error: updateError } = await locals.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error("[Auth] Password change error:", updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: "UPDATE_FAILED",
            message: updateError.message || "Failed to update password",
          },
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 5. Success
    return new Response(
      JSON.stringify({
        status: "success",
        message: "Password changed successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Auth] Unexpected error in password change:", err);
    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      } satisfies ErrorResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
