import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitService } from "../rate-limit.service";
import type { SupabaseClient } from "../../../db/supabase.client";

describe("RateLimitService", () => {
  let service: RateLimitService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
    };
    service = new RateLimitService(mockSupabase as SupabaseClient);
  });

  it("should allow AI rate limit when count is low", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ count: 5, reset_at: Date.now() + 10000 }],
      error: null,
    });

    const result = await service.checkAIRateLimit("user1");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "ai_gen:user1",
    });
    expect(result.allowed).toBe(true);
    // Limit is 10, count is 5, remaining is 5
    expect(result.remaining).toBe(5);
  });

  it("should block AI rate limit when count exceeds limit", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ count: 10, reset_at: Date.now() + 10000 }],
      error: null,
    });

    const result = await service.checkAIRateLimit("user1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should increment AI rate limit", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: null,
    });

    await service.incrementAIRateLimit("user1");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
      p_key: "ai_gen:user1",
      p_window_ms: 60000,
    });
  });

  it("should throw error when check RPC fails", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "RPC Error" },
    });

    await expect(service.checkAIRateLimit("user1")).rejects.toThrow("Rate limit check failed");
  });

  it("should throw error when increment RPC fails", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "RPC Error" },
    });

    await expect(service.incrementAIRateLimit("user1")).rejects.toThrow("Rate limit increment failed");
  });
});
