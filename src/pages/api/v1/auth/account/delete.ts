/**
 * DELETE /api/v1/auth/account/delete
 * Permanently delete user account and all associated data
 * 
 * Requires explicit confirmation.
 * US-004: Delete Account
 */

import type { APIRoute } from 'astro';
import { deleteAccountSchema } from '@/lib/validation/auth.schemas';
import type { ErrorResponse, ValidationErrorResponse } from '@/types';

export const prerender = false;

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } satisfies ErrorResponse),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
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
            code: 'BAD_REQUEST',
            message: 'Invalid JSON in request body',
          },
        } satisfies ErrorResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const validation = deleteAccountSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Confirmation failed',
            errors: validation.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        } satisfies ValidationErrorResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Delete user data
    // Note: Database cascading deletes will handle:
    // - cards (via decks foreign key)
    // - reviews (via cards foreign key)
    // - ai_generation_logs (via user_id foreign key)
    
    // Delete decks (cascades to cards and reviews)
    const { error: decksDeleteError } = await locals.supabase
      .from('decks')
      .delete()
      .eq('user_id', user.id);

    if (decksDeleteError) {
      console.error('[Auth] Failed to delete user decks:', decksDeleteError);
      // Continue anyway - try to delete other data
    }

    // Delete AI generation logs
    const { error: logsDeleteError } = await locals.supabase
      .from('ai_generation_logs')
      .delete()
      .eq('user_id', user.id);

    if (logsDeleteError) {
      console.error('[Auth] Failed to delete AI logs:', logsDeleteError);
      // Continue anyway
    }

    // Delete profile (if exists)
    const { error: profileDeleteError } = await locals.supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileDeleteError) {
      console.error('[Auth] Failed to delete profile:', profileDeleteError);
      // Continue anyway
    }

    // 4. Delete auth user (this is the final step)
    const { error: deleteUserError } = await locals.supabase.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('[Auth] Failed to delete auth user:', deleteUserError);
      return new Response(
        JSON.stringify({
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete account. Please contact support.',
          },
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Sign out (clear session)
    await locals.supabase.auth.signOut();

    // 6. Success
    return new Response(
      JSON.stringify({
        status: 'deleted',
        message: 'Account permanently deleted',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[Auth] Unexpected error in account deletion:', err);
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      } satisfies ErrorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};


