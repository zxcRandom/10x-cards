import type { RateLimitEntry, RateLimitStorage } from "./storage";

export class InMemoryRateLimitStorage implements RateLimitStorage {
  private storage = new Map<string, RateLimitEntry>();

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.storage.get(key);
    const now = Date.now();

    if (!entry || entry.resetAt < now) {
      if (entry) {
        this.storage.delete(key);
      }
      return null;
    }

    return { ...entry };
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    let entry = this.storage.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.storage.set(key, entry);
    } else {
      entry.count++;
      // Update in map (not strictly necessary for object reference, but good practice)
      this.storage.set(key, entry);
    }

    // Lazy cleanup
    this.cleanup();

    return { ...entry };
  }

  /**
   * Simple cleanup of expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (entry.resetAt < now) {
        this.storage.delete(key);
      }
    }
  }
}
