/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimitService } from "../rate-limit.service";
import { InMemoryRateLimitStorage } from "../rate-limit/in-memory.storage";
import { SupabaseRateLimitStorage } from "../rate-limit/supabase.storage";
import type { SupabaseClient } from "../../../db/supabase.client";

describe("InMemoryRateLimitStorage", () => {
  let storage: InMemoryRateLimitStorage;

  beforeEach(() => {
    storage = new InMemoryRateLimitStorage();
  });

  it("should return null for non-existent key", async () => {
    const entry = await storage.get("test");
    expect(entry).toBeNull();
  });

  it("should increment count for new key", async () => {
    const entry = await storage.increment("test", 1000);
    expect(entry.count).toBe(1);
    expect(entry.resetAt).toBeGreaterThan(Date.now());
  });

  it("should increment count for existing key", async () => {
    await storage.increment("test", 1000);
    const entry = await storage.increment("test", 1000);
    expect(entry.count).toBe(2);
  });

  it("should reset expired key", async () => {
    const now = 1000000000000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await storage.increment("test", 1000); // resetAt = now + 1000

    vi.setSystemTime(now + 2000);

    const entry = await storage.get("test");
    expect(entry).toBeNull();

    const newEntry = await storage.increment("test", 1000);
    expect(newEntry.count).toBe(1);

    vi.useRealTimers();
  });
});

describe("SupabaseRateLimitStorage", () => {
  let storage: SupabaseRateLimitStorage;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
    };
    storage = new SupabaseRateLimitStorage(mockSupabase as SupabaseClient);
  });

  it("should call check_rate_limit RPC on get", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ count: 5, reset_at: 123456789 }],
      error: null,
    });

    const entry = await storage.get("test-key");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("check_rate_limit", { p_key: "test-key" });
    expect(entry).toEqual({ count: 5, resetAt: 123456789 });
  });

  it("should call increment_rate_limit RPC on increment", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ error: null }); // increment
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ count: 1, reset_at: 123456789 }],
      error: null,
    }); // get after increment

    const entry = await storage.increment("test-key", 60000);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
      p_key: "test-key",
      p_window_ms: 60000,
    });
    expect(entry.count).toBe(1);
  });
});

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
    // Default to Supabase storage for service tests
    service = new RateLimitService(mockSupabase as SupabaseClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkAIRateLimit", () => {
    it("should allow request when no entry exists", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
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
    });

    it("should block request when limit is exceeded", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 10, reset_at: now + 10000 }],
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should allow request after window expires", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 10, reset_at: now - 1000 }],
        error: null,
      });

      const result = await service.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it("should fallback to InMemory storage when Supabase is null", async () => {
      const devService = new RateLimitService(null);
      const result = await devService.checkAIRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      
      await devService.incrementAIRateLimit(userId);
      const result2 = await devService.checkAIRateLimit(userId);
      expect(result2.remaining).toBe(9);
    });
  });

  describe("incrementAIRateLimit", () => {
    it("should call increment on storage", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: null }); // increment
      mockSupabase.rpc.mockResolvedValueOnce({
          data: [{ count: 1, reset_at: now + 60000 }],
          error: null,
      }); // get

      await service.incrementAIRateLimit(userId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", expect.anything());
    });
  });

  describe("Auth Rate Limits", () => {
    const authId = "test@example.com";

    it("should enforce limits for sign-in", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ count: 5, reset_at: now + 10000 }],
        error: null,
      });

      const result = await service.checkAuthSignInRateLimit(authId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });
});
