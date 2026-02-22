/**
 * RateLimitService - Rate limiting for API endpoints using Supabase
 *
 * Uses Supabase RPC for atomic rate limiting.
 */

import type { SupabaseClient } from "../../db/supabase.client";

export class RateLimitService {
  private readonly limits = {
    aiGeneration: { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
    aiLogs: { requests: 100, windowMs: 60 * 1000 }, // 100 req/min
    authSignIn: { requests: 5, windowMs: 60 * 1000 }, // 5 req/min
    authSignUp: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
    authPasswordReset: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
  };

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Check if user has exceeded AI generation rate limit
   *
   * @param userId - User ID to check
   * @returns Object with allowed status and remaining requests
   */
  async checkAIRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const key = `ai_gen:${userId}`;
    return this.checkRateLimit(key, "aiGeneration");
  }

  /**
   * Increment AI generation rate limit counter
   *
   * @param userId - User ID to increment
   */
  async incrementAIRateLimit(userId: string): Promise<void> {
    const key = `ai_gen:${userId}`;
    return this.incrementRateLimit(key, "aiGeneration");
  }

  /**
   * Get remaining requests for user
   *
   * @param userId - User ID to check
   * @returns Number of remaining requests
   */
  async getRemainingRequests(userId: string): Promise<number> {
    const result = await this.checkAIRateLimit(userId);
    return result.remaining;
  }

  /**
   * Generic rate limit check using Supabase RPC
   *
   * @param key - Rate limit key
   * @param limitType - Type of limit to apply
   * @returns Object with allowed status and remaining requests
   */
  private async checkRateLimit(
    key: string,
    limitType: keyof typeof this.limits
  ): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const limit = this.limits[limitType];
    const now = Date.now();

    // Call Supabase RPC to check limit
    const { data, error } = await this.supabase.rpc("check_rate_limit", { p_key: key });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[RateLimitService] Check failed:", error);
      // Fail closed for security
      throw new Error("Rate limit check failed");
    }

    // Parse result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;

    if (!row) {
      // No entry, allow full limit
      return {
        allowed: true,
        remaining: limit.requests,
      };
    }

    const count = Number(row.count);
    const resetAt = Number(row.reset_at);

    // If expired, allow full limit (minus 1 effectively, but here we just check)
    // Actually, if expired, count should be reset on next increment.
    // For check, we can treat it as 0 used.
    if (resetAt < now) {
      return {
        allowed: true,
        remaining: limit.requests,
      };
    }

    const remaining = Math.max(0, limit.requests - count);
    const resetInMs = Math.max(0, resetAt - now);

    return {
      allowed: count < limit.requests,
      remaining,
      resetInMs,
    };
  }

  /**
   * Generic rate limit increment using Supabase RPC
   *
   * @param key - Rate limit key
   * @param limitType - Type of limit to apply
   */
  private async incrementRateLimit(key: string, limitType: keyof typeof this.limits): Promise<void> {
    const limit = this.limits[limitType];

    const { error } = await this.supabase.rpc("increment_rate_limit", {
      p_key: key,
      p_window_ms: limit.windowMs,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[RateLimitService] Increment failed:", error);
      throw new Error("Rate limit increment failed");
    }
  }

  /**
   * Check auth sign-in rate limit
   */
  async checkAuthSignInRateLimit(
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const key = `auth_signin:${identifier}`;
    return this.checkRateLimit(key, "authSignIn");
  }

  /**
   * Increment auth sign-in rate limit
   */
  async incrementAuthSignInRateLimit(identifier: string): Promise<void> {
    const key = `auth_signin:${identifier}`;
    return this.incrementRateLimit(key, "authSignIn");
  }

  /**
   * Check auth sign-up rate limit
   */
  async checkAuthSignUpRateLimit(
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const key = `auth_signup:${identifier}`;
    return this.checkRateLimit(key, "authSignUp");
  }

  /**
   * Increment auth sign-up rate limit
   */
  async incrementAuthSignUpRateLimit(identifier: string): Promise<void> {
    const key = `auth_signup:${identifier}`;
    return this.incrementRateLimit(key, "authSignUp");
  }

  /**
   * Check password reset rate limit
   */
  async checkPasswordResetRateLimit(
    identifier: string
  ): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const key = `auth_password_reset:${identifier}`;
    return this.checkRateLimit(key, "authPasswordReset");
  }

  /**
   * Increment password reset rate limit
   */
  async incrementPasswordResetRateLimit(identifier: string): Promise<void> {
    const key = `auth_password_reset:${identifier}`;
    return this.incrementRateLimit(key, "authPasswordReset");
  }
}
