/**
 * Simple in-memory rate limiter for MVP
 * For production, use Redis or similar distributed cache
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * RateLimitService - Simple rate limiting for API endpoints
 *
 * MVP Implementation: Uses in-memory Map
 * Production TODO: Replace with Redis for distributed rate limiting
 */
export class RateLimitService {
  private readonly limits = {
    aiGeneration: { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
    aiLogs: { requests: 100, windowMs: 60 * 1000 }, // 100 req/min
    authSignIn: { requests: 5, windowMs: 60 * 1000 }, // 5 req/min
    authSignUp: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
    authPasswordReset: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
  };

  // In-memory storage (MVP only)
  private storage = new Map<string, RateLimitEntry>();

  /**
   * Check if user has exceeded AI generation rate limit
   *
   * @param userId - User ID to check
   * @returns Object with allowed status and remaining requests
   */
  async checkAIRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const key = `ai_gen:${userId}`;
    const now = Date.now();
    const limit = this.limits.aiGeneration;

    const entry = this.storage.get(key);

    // No entry or expired - allow request
    if (!entry || entry.resetAt < now) {
      return {
        allowed: true,
        remaining: limit.requests - 1,
      };
    }

    // Check if limit exceeded
    const remaining = Math.max(0, limit.requests - entry.count);
    const resetInMs = Math.max(0, entry.resetAt - now);
    return {
      allowed: entry.count < limit.requests,
      remaining,
      resetInMs,
    };
  }

  /**
   * Increment AI generation rate limit counter
   *
   * @param userId - User ID to increment
   */
  async incrementAIRateLimit(userId: string): Promise<void> {
    const key = `ai_gen:${userId}`;
    const now = Date.now();
    const limit = this.limits.aiGeneration;

    const entry = this.storage.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry
      this.storage.set(key, {
        count: 1,
        resetAt: now + limit.windowMs,
      });
    } else {
      // Increment existing entry
      entry.count++;
    }

    // Cleanup old entries (simple garbage collection)
    this.cleanup();
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
   * Simple cleanup of expired entries
   * Production: Use scheduled job with Redis TTL
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (entry.resetAt < now) {
        this.storage.delete(key);
      }
    }
  }

  /**
   * Generic rate limit check
   *
   * @param key - Rate limit key
   * @param limitType - Type of limit to apply
   * @returns Object with allowed status and remaining requests
   */
  private async checkRateLimit(
    key: string,
    limitType: keyof typeof this.limits
  ): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const now = Date.now();
    const limit = this.limits[limitType];

    const entry = this.storage.get(key);

    // No entry or expired - allow request
    if (!entry || entry.resetAt < now) {
      return {
        allowed: true,
        remaining: limit.requests - 1,
      };
    }

    // Check if limit exceeded
    const remaining = Math.max(0, limit.requests - entry.count);
    const resetInMs = Math.max(0, entry.resetAt - now);
    return {
      allowed: entry.count < limit.requests,
      remaining,
      resetInMs,
    };
  }

  /**
   * Generic rate limit increment
   *
   * @param key - Rate limit key
   * @param limitType - Type of limit to apply
   */
  private async incrementRateLimit(key: string, limitType: keyof typeof this.limits): Promise<void> {
    const now = Date.now();
    const limit = this.limits[limitType];

    const entry = this.storage.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry
      this.storage.set(key, {
        count: 1,
        resetAt: now + limit.windowMs,
      });
    } else {
      // Increment existing entry
      entry.count++;
    }

    // Cleanup old entries (simple garbage collection)
    this.cleanup();
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
