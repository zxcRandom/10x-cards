export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitStorage {
  /**
   * Get the current rate limit entry for a key.
   * @param key The unique key for the rate limit.
   * @returns The rate limit entry, or null if not found.
   */
  get(key: string): Promise<RateLimitEntry | null>;

  /**
   * Increment the counter for a key.
   * If the key does not exist or has expired, it should be created/reset.
   *
   * @param key The unique key for the rate limit.
   * @param windowMs The time-to-live for the rate limit window in milliseconds.
   * @returns The updated rate limit entry.
   */
  increment(key: string, windowMs: number): Promise<RateLimitEntry>;
}
