import type { SupabaseClient } from "../../../db/supabase.client";
import type { RateLimitEntry, RateLimitStorage } from "./storage";

export class SupabaseRateLimitStorage implements RateLimitStorage {
  constructor(private readonly supabase: SupabaseClient) {}

  async get(key: string): Promise<RateLimitEntry | null> {
    const { data, error } = await this.supabase.rpc("check_rate_limit", { p_key: key });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[SupabaseRateLimitStorage] Check failed:", error);
      throw new Error("Rate limit check failed");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;

    if (!row) {
      return null;
    }

    return {
      count: Number(row.count),
      resetAt: Number(row.reset_at),
    };
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const { error } = await this.supabase.rpc("increment_rate_limit", {
      p_key: key,
      p_window_ms: windowMs,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[SupabaseRateLimitStorage] Increment failed:", error);
      throw new Error("Rate limit increment failed");
    }

    // After increment, we need the new state. Supabase increment RPC currently doesn't return data,
    // so we fetch it. This is slightly less efficient but maintains compatibility.
    const entry = await this.get(key);
    if (!entry) {
        throw new Error("Failed to retrieve rate limit entry after increment");
    }
    return entry;
  }
}
