import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimitService } from "../rate-limit.service";
import { InMemoryRateLimitStorage } from "../rate-limit/in-memory.storage";

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
    // We mock Date.now to control time
    const now = 1000000000000;

    // Set fixed time
    vi.spyOn(Date, "now").mockReturnValue(now);

    await storage.increment("test", 1000); // resetAt = now + 1000

    // Advance time beyond expiration
    vi.spyOn(Date, "now").mockReturnValue(now + 2000);

    const entry = await storage.get("test");
    expect(entry).toBeNull();

    const newEntry = await storage.increment("test", 1000);
    expect(newEntry.count).toBe(1);

    // Restore Date.now
    vi.restoreAllMocks();
  });
});

describe("RateLimitService", () => {
  let service: RateLimitService;

  beforeEach(() => {
    // Ensure REDIS_URL is not set
    delete process.env.REDIS_URL;
    service = new RateLimitService();
  });

  it("should allow request within limit", async () => {
    const result = await service.checkAIRateLimit("user1");
    expect(result.allowed).toBe(true);
    // Logic: requests=10. check assumes 1 pending usage if not tracked yet.
    // If no entry, remaining = 10 - 1 = 9.
    expect(result.remaining).toBe(9);
  });

  it("should decrement remaining requests", async () => {
    await service.incrementAIRateLimit("user1");
    const result = await service.checkAIRateLimit("user1");
    expect(result.allowed).toBe(true);
    // limit=10. used=1. check assumes another 1 pending usage?
    // checkAIRateLimit: entry.count=1. remaining = 10 - 1 = 9.

    // Wait, let's verify logic in service:
    // const remaining = Math.max(0, limit.requests - entry.count);
    // If count=1, remaining=9.

    expect(result.remaining).toBe(9);

    // If we call increment again:
    await service.incrementAIRateLimit("user1");
    // count=2. check -> remaining=8.
    const result2 = await service.checkAIRateLimit("user1");
    expect(result2.remaining).toBe(8);
  });

  it("should block request when limit exceeded", async () => {
    for (let i = 0; i < 10; i++) {
      await service.incrementAIRateLimit("user1");
    }
    // count = 10.
    // check: remaining = 10 - 10 = 0.
    // allowed: count (10) < limit (10) -> false.
    const result = await service.checkAIRateLimit("user1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should return correct reset time", async () => {
    await service.incrementAIRateLimit("user1");
    const result = await service.checkAIRateLimit("user1");
    expect(result.resetInMs).toBeGreaterThan(0);
    expect(result.resetInMs).toBeLessThanOrEqual(60000);
  });
});
