import Redis from "ioredis";
import type { RateLimitEntry, RateLimitStorage } from "./storage";

export class RedisRateLimitStorage implements RateLimitStorage {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      // Retry strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const pttl = await this.redis.pttl(key);

    if (pttl < 0) {
      return null;
    }

    const count = await this.redis.get(key);
    if (!count) {
      return null;
    }

    return {
      count: parseInt(count, 10),
      resetAt: Date.now() + pttl,
    };
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    // Atomic increment and expiry setting
    // We use a Lua script to ensure atomicity
    // If key exists, INCR
    // If key doesn't exist, SET with EX (PX for milliseconds)

    // Actually, simple logic:
    // PTTL key
    // if TTL < 0:
    //   SET key 1 PX windowMs
    // else:
    //   INCR key
    //   (keep existing TTL)

    // Using a Lua script is safer to avoid race conditions where PTTL returns -2 (not exists)
    // but another client creates it before we SET.

    const script = `
      local ttl = redis.call('pttl', KEYS[1])
      if ttl < 0 then
        redis.call('set', KEYS[1], 1, 'px', ARGV[1])
        return {1, tonumber(ARGV[1])}
      else
        local count = redis.call('incr', KEYS[1])
        return {count, ttl}
      end
    `;

    const result = (await this.redis.eval(script, 1, key, windowMs)) as [number, number];
    const count = result[0];
    const ttl = result[1];

    return {
      count,
      resetAt: Date.now() + ttl,
    };
  }
}
