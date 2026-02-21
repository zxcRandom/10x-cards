import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { RateLimitService } from "../rate-limit.service";
import Redis from "ioredis";

// Mock ioredis
vi.mock("ioredis", () => {
  const Redis = vi.fn();
  Redis.prototype.get = vi.fn();
  Redis.prototype.incr = vi.fn();
  Redis.prototype.pttl = vi.fn();
  Redis.prototype.pexpire = vi.fn();
  Redis.prototype.on = vi.fn();
  return { default: Redis };
});

describe("RateLimitService", () => {
  let service: RateLimitService;
  // Access mock methods
  const mockGet = Redis.prototype.get as Mock;
  const mockIncr = Redis.prototype.incr as Mock;
  const mockPttl = Redis.prototype.pttl as Mock;
  const mockPexpire = Redis.prototype.pexpire as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("In-memory fallback (No Redis URL)", () => {
    beforeEach(() => {
      // Ensure Redis is not used
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Private property access
      RateLimitService.redisInstance = null;
      service = new RateLimitService(undefined);
    });

    it("should allow request when within limit", async () => {
      const result = await service.checkAIRateLimit("user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1
    });

    it("should increment count and block when limit exceeded", async () => {
      // Consume all 10 requests
      for (let i = 0; i < 10; i++) {
        await service.incrementAIRateLimit("user1");
      }

      const result = await service.checkAIRateLimit("user1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe("Redis implementation", () => {
    beforeEach(() => {
      // Reset static instance to force new connection
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Private property access
      RateLimitService.redisInstance = null;
      service = new RateLimitService("redis://localhost:6379");
    });

    it("should initialize Redis client", () => {
      expect(Redis).toHaveBeenCalledWith("redis://localhost:6379", {
        enableOfflineQueue: false,
        commandTimeout: 2000,
      });
    });

    it("should check limit using Redis", async () => {
      mockGet.mockResolvedValue("5"); // 5 requests used
      mockPttl.mockResolvedValue(50000); // 50s remaining

      const result = await service.checkAIRateLimit("user1");

      expect(mockGet).toHaveBeenCalledWith("ai_gen:user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5
    });

    it("should increment limit using Redis", async () => {
      mockIncr.mockResolvedValue(1); // First request

      await service.incrementAIRateLimit("user1");

      expect(mockIncr).toHaveBeenCalledWith("ai_gen:user1");
      expect(mockPexpire).toHaveBeenCalledWith("ai_gen:user1", 60000);
    });

    it("should not set expire if increment > 1", async () => {
      mockIncr.mockResolvedValue(2);

      await service.incrementAIRateLimit("user1");

      expect(mockIncr).toHaveBeenCalledWith("ai_gen:user1");
      expect(mockPexpire).not.toHaveBeenCalled();
    });

    it("should fallback to memory on Redis error", async () => {
      mockGet.mockRejectedValue(new Error("Redis down"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await service.checkAIRateLimit("user1");

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.allowed).toBe(true); // Fallback behavior (empty memory)

      consoleSpy.mockRestore();
    });
  });
});
