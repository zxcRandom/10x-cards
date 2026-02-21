/**
 * Rate Limiting Service
 *
 * Provides rate limiting functionality using configurable storage backends.
 * Supports InMemory (default) and Redis (via REDIS_URL env var).
 */

import { InMemoryRateLimitStorage } from "./rate-limit/in-memory.storage";
import { RedisRateLimitStorage } from "./rate-limit/redis.storage";
import type { RateLimitStorage } from "./rate-limit/storage";

/**
 * RateLimitService - Simple rate limiting for API endpoints
 *
 * Uses pluggable storage (InMemory for MVP/dev, Redis for production).
 */
export class RateLimitService {
  private readonly limits = {
    aiGeneration: { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
    aiLogs: { requests: 100, windowMs: 60 * 1000 }, // 100 req/min
    authSignIn: { requests: 5, windowMs: 60 * 1000 }, // 5 req/min
    authSignUp: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
    authPasswordReset: { requests: 3, windowMs: 60 * 1000 }, // 3 req/min
  };

  private storage: RateLimitStorage;

  constructor() {
    // Check for Redis URL in environment variables
    // Prefer process.env for Node/Serverless environments
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      // eslint-disable-next-line no-console
      console.log("Initializing RateLimitService with Redis storage");
      this.storage = new RedisRateLimitStorage(redisUrl);
    } else {
      // eslint-disable-next-line no-console
      console.log("Initializing RateLimitService with In-Memory storage (not suitable for serverless production)");
      this.storage = new InMemoryRateLimitStorage();
    }
  }

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
    await this.incrementRateLimit(key, "aiGeneration");
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

    const entry = await this.storage.get(key);

    // No entry or expired - allow request
    if (!entry || entry.resetAt < now) {
      return {
        allowed: true,
        remaining: limit.requests - 1, // Expecting one request to be made
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
    const limit = this.limits[limitType];
    await this.storage.increment(key, limit.windowMs);
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
