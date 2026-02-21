import Redis from "ioredis";

/**
 * Simple in-memory rate limiter for MVP
 * For production, use Redis or similar distributed cache
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * RateLimitService - Rate limiting for API endpoints
 *
 * Uses Redis if configured, otherwise falls back to in-memory Map
 */
export class RateLimitService {
  private static redisInstance: Redis | null = null;
  private readonly limits = {
    aiGeneration: { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
    aiLogs: { requests: 100, windowMs: 60 * 1000 }, // 100 req/min
    authSignIn: { requests: 5, windowMs: 60 * 1000 }, // 5 req/min
    authSignUp: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
    authPasswordReset: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
  };

  // In-memory storage (fallback)
  private storage = new Map<string, RateLimitEntry>();
  private useRedis = false;

  constructor(redisUrl?: string) {
    if (redisUrl) {
      if (!RateLimitService.redisInstance) {
        RateLimitService.redisInstance = new Redis(redisUrl);
        // Handle error to prevent crash
        RateLimitService.redisInstance.on("error", (err) => {
          // eslint-disable-next-line no-console
          console.error("Redis error:", err);
        });
      }
      this.useRedis = true;
    }
  }

  /**
   * Generic rate limit check helper
   */
  private async checkLimit(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    if (this.useRedis && RateLimitService.redisInstance) {
      try {
        const countStr = await RateLimitService.redisInstance.get(key);
        const count = countStr ? parseInt(countStr, 10) : 0;
        const ttl = await RateLimitService.redisInstance.pttl(key);

        // If key exists but no TTL (should not happen with correct logic), set it
        if (count > 0 && ttl === -1) {
          await RateLimitService.redisInstance.pexpire(key, windowMs);
        }

        const resetInMs = ttl > 0 ? ttl : 0;
        const remaining = Math.max(0, maxRequests - count);

        return {
          allowed: count < maxRequests,
          remaining,
          resetInMs,
        };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Redis check error, falling back to memory:", error);
        // Fallback to memory
      }
    }

    // In-memory implementation
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry || entry.resetAt < now) {
      return {
        allowed: true,
        remaining: maxRequests - 1,
      };
    }

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetInMs = Math.max(0, entry.resetAt - now);
    return {
      allowed: entry.count < maxRequests,
      remaining,
      resetInMs,
    };
  }

  /**
   * Generic rate limit increment helper
   */
  private async incrementLimit(key: string, windowMs: number): Promise<void> {
    if (this.useRedis && RateLimitService.redisInstance) {
      try {
        const count = await RateLimitService.redisInstance.incr(key);
        if (count === 1) {
          await RateLimitService.redisInstance.pexpire(key, windowMs);
        }
        return;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Redis increment error, falling back to memory:", error);
      }
    }

    // In-memory implementation
    const now = Date.now();
    const entry = this.storage.get(key);

    if (!entry || entry.resetAt < now) {
      this.storage.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      entry.count++;
    }
    this.cleanup();
  }

  /**
   * Check if user has exceeded AI generation rate limit
   *
   * @param userId - User ID to check
   * @returns Object with allowed status and remaining requests
   */
  async checkAIRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetInMs?: number }> {
    const key = `ai_gen:${userId}`;
    const limit = this.limits.aiGeneration;
    return this.checkLimit(key, limit.requests, limit.windowMs);
  }

  /**
   * Increment AI generation rate limit counter
   *
   * @param userId - User ID to increment
   */
  async incrementAIRateLimit(userId: string): Promise<void> {
    const key = `ai_gen:${userId}`;
    const limit = this.limits.aiGeneration;
    await this.incrementLimit(key, limit.windowMs);
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
    if (this.useRedis) return;

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
    const limit = this.limits[limitType];
    return this.checkLimit(key, limit.requests, limit.windowMs);
  }

  /**
   * Generic rate limit increment
   *
   * @param key - Rate limit key
   * @param limitType - Type of limit to apply
   */
  private async incrementRateLimit(key: string, limitType: keyof typeof this.limits): Promise<void> {
    const limit = this.limits[limitType];
    await this.incrementLimit(key, limit.windowMs);
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
