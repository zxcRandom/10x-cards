import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimitService } from "../rate-limit.service";

describe("RateLimitService", () => {
  let rateLimitService: RateLimitService;
  const userId = "test-user-id";
  // Use a fixed timestamp for consistent testing
  const now = 1000000000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    rateLimitService = new RateLimitService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkAIRateLimit", () => {
    it("should allow request when no entry exists", async () => {
      const result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      // Note: Current implementation returns limit - 1 (9) when no entry exists
      expect(result.remaining).toBe(9);
    });

    it("should allow request when entry exists and is within limit", async () => {
      // Create an entry with count 1
      await rateLimitService.incrementAIRateLimit(userId);

      const result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it("should block request when limit is exceeded", async () => {
      // Consume all 10 requests
      for (let i = 0; i < 10; i++) {
        await rateLimitService.incrementAIRateLimit(userId);
      }

      const result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      // Should return approximate time until reset
      // We need to check if resetInMs is close to windowMs
      // Since we just incremented, resetAt is now + windowMs
      expect(result.resetInMs).toBe(60 * 1000);
    });

    it("should allow request after window expires", async () => {
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await rateLimitService.incrementAIRateLimit(userId);
      }

      // Verify blocked
      let result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(false);

      // Advance time by 60 seconds + 1ms to ensure expiry
      vi.setSystemTime(now + 60 * 1000 + 1);

      // Should be allowed now (treated as new window)
      result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe("incrementAIRateLimit", () => {
    it("should create new entry if none exists", async () => {
      await rateLimitService.incrementAIRateLimit(userId);
      // We can verify by checking rate limit status
      const result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.remaining).toBe(9);
    });

    it("should increment count if entry exists", async () => {
      await rateLimitService.incrementAIRateLimit(userId); // count 1
      await rateLimitService.incrementAIRateLimit(userId); // count 2

      const result = await rateLimitService.checkAIRateLimit(userId);
      // Limit 10, count 2 -> remaining 8
      expect(result.remaining).toBe(8);
    });

    it("should cleanup expired entries when incrementing", async () => {
      await rateLimitService.incrementAIRateLimit(userId);

      // Advance time past window
      const future = now + 60 * 1000 + 1;
      vi.setSystemTime(future);

      // Incrementing for ANY user should trigger cleanup
      // But specifically, incrementing for this user should treat it as a new window
      await rateLimitService.incrementAIRateLimit(userId);

      // If it was treated as new window, count should be 1
      const result = await rateLimitService.checkAIRateLimit(userId);
      expect(result.remaining).toBe(9);
    });

    it("should remove expired entries from storage", async () => {
      await rateLimitService.incrementAIRateLimit(userId);
      expect((rateLimitService as any).storage.size).toBe(1);

      // Advance time past window
      vi.setSystemTime(now + 60 * 1000 + 1);

      // Trigger cleanup by incrementing for another user
      await rateLimitService.incrementAIRateLimit("other-user");

      // Storage should have only "other-user" now, "userId" should be gone
      expect((rateLimitService as any).storage.size).toBe(1);
      expect((rateLimitService as any).storage.has(`ai_gen:${userId}`)).toBe(false);
    });
  });

  describe("getRemainingRequests", () => {
    it("should return correct remaining requests", async () => {
      expect(await rateLimitService.getRemainingRequests(userId)).toBe(9);

      await rateLimitService.incrementAIRateLimit(userId);
      expect(await rateLimitService.getRemainingRequests(userId)).toBe(9);

      await rateLimitService.incrementAIRateLimit(userId);
      expect(await rateLimitService.getRemainingRequests(userId)).toBe(8);
    });
  });

  describe("Auth Rate Limits", () => {
    const authId = "test@example.com";

    describe("authSignIn", () => {
      it("should enforce limit of 5 requests per minute", async () => {
        for (let i = 0; i < 5; i++) {
          await rateLimitService.incrementAuthSignInRateLimit(authId);
        }

        const result = await rateLimitService.checkAuthSignInRateLimit(authId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });
    });

    describe("authSignUp", () => {
      it("should enforce limit of 3 requests per minute", async () => {
        for (let i = 0; i < 3; i++) {
          await rateLimitService.incrementAuthSignUpRateLimit(authId);
        }

        const result = await rateLimitService.checkAuthSignUpRateLimit(authId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });
    });

    describe("authPasswordReset", () => {
      it("should enforce limit of 3 requests per minute", async () => {
        for (let i = 0; i < 3; i++) {
          await rateLimitService.incrementPasswordResetRateLimit(authId);
        }

        const result = await rateLimitService.checkPasswordResetRateLimit(authId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });
    });
  });
});
