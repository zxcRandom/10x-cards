/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitService } from "../rate-limit.service";
import type { SupabaseClient } from "../../../db/supabase.client";

describe("RateLimitService", () => {
  let service: RateLimitService;
  let mockSupabase: any;
  const userId = "test-user-id";
  const now = 1000000000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockSupabase = {
      rpc: vi.fn(),
    };
    service = new RateLimitService(mockSupabase as SupabaseClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkAIRateLimit", () => {
    it("should allow request when no entry exists (RPC returns null data)", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("check_rate_limit", {
        p_key: `ai_gen:${userId}`,
      });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it("should allow request when no entry exists (RPC returns empty array)", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it("should allow request when entry exists and is within limit", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 5, reset_at: now + 10000 }],
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.resetInMs).toBe(10000);
    });

    it("should block request when limit is exceeded", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 10, reset_at: now + 10000 }],
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetInMs).toBe(10000);
    });

    it("should allow request after window expires (reset_at < now)", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 10, reset_at: now - 1000 }],
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it("should allow request when Supabase client is null (dev/test mode)", async () => {
      const devService = new RateLimitService(null);
      const result = await devService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });
  });

  describe("incrementAIRateLimit", () => {
    it("should call increment RPC with correct parameters", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.incrementAIRateLimit(userId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
        p_key: `ai_gen:${userId}`,
        p_window_ms: 60000,
      });
    });

    it("should skip increment when Supabase client is null", async () => {
      const devService = new RateLimitService(null);
      await devService.incrementAIRateLimit(userId);
      // No crash, success
    });
  });

  describe("getRemainingRequests", () => {
    it("should return correct remaining requests", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 7, reset_at: now + 10000 }],
        error: null,
      });

      const remaining = await service.getRemainingRequests(userId);
      expect(remaining).toBe(3);
    });
  });

  describe("Auth Rate Limits", () => {
    const authId = "test@example.com";

    describe("authSignIn", () => {
      it("should enforce limit of 5 requests", async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: [{ count: 5, reset_at: now + 10000 }],
          error: null,
        });

        const result = await service.checkAuthSignInRateLimit(authId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);

        await service.incrementAuthSignInRateLimit(authId);
        expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
          p_key: `auth_signin:${authId}`,
          p_window_ms: 60000,
        });
      });
    });

    describe("authSignUp", () => {
      it("should enforce limit of 3 requests", async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: [{ count: 3, reset_at: now + 10000 }],
          error: null,
        });

        const result = await service.checkAuthSignUpRateLimit(authId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);

        await service.incrementAuthSignUpRateLimit(authId);
        expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
          p_key: `auth_signup:${authId}`,
          p_window_ms: 60000,
        });
      });
    });

    describe("authPasswordReset", () => {
      it("should enforce limit of 3 requests", async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: [{ count: 3, reset_at: now + 10000 }],
          error: null,
        });

        const result = await service.checkPasswordResetRateLimit(authId);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);

        await service.incrementPasswordResetRateLimit(authId);
        expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
          p_key: `auth_password_reset:${authId}`,
          p_window_ms: 60000,
        });
      });
    });
  });

  describe("Error handling", () => {
    it("should throw error when check RPC fails", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC Error" },
      });

      await expect(service.checkAIRateLimit(userId)).rejects.toThrow("Rate limit check failed");
    });

    it("should throw error when increment RPC fails", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC Error" },
      });

      await expect(service.incrementAIRateLimit(userId)).rejects.toThrow("Rate limit increment failed");
    });
  });
});
