/**
 * Simple in-memory rate limiter for MVP
 * For production, use Redis or similar distributed cache
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

/**
 * RateLimitService - Simple rate limiting for API endpoints
 * 
 * MVP Implementation: Uses in-memory Map
 * Production TODO: Replace with Redis for distributed rate limiting
 */
export class RateLimitService {
	private readonly limits = {
		aiGeneration: { requests: 10, windowMs: 60 * 1000 }, // 10 req/min
		aiLogs: { requests: 100, windowMs: 60 * 1000 }, // 100 req/min
	};

	// In-memory storage (MVP only)
	private storage = new Map<string, RateLimitEntry>();

	/**
	 * Check if user has exceeded AI generation rate limit
	 * 
	 * @param userId - User ID to check
	 * @returns Object with allowed status and remaining requests
	 */
	async checkAIRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
		const key = `ai_gen:${userId}`;
		const now = Date.now();
		const limit = this.limits.aiGeneration;

		const entry = this.storage.get(key);

		// No entry or expired - allow request
		if (!entry || entry.resetAt < now) {
			return {
				allowed: true,
				remaining: limit.requests - 1,
			};
		}

		// Check if limit exceeded
		const remaining = Math.max(0, limit.requests - entry.count);
		return {
			allowed: entry.count < limit.requests,
			remaining,
		};
	}

	/**
	 * Increment AI generation rate limit counter
	 * 
	 * @param userId - User ID to increment
	 */
	async incrementAIRateLimit(userId: string): Promise<void> {
		const key = `ai_gen:${userId}`;
		const now = Date.now();
		const limit = this.limits.aiGeneration;

		const entry = this.storage.get(key);

		if (!entry || entry.resetAt < now) {
			// Create new entry
			this.storage.set(key, {
				count: 1,
				resetAt: now + limit.windowMs,
			});
		} else {
			// Increment existing entry
			entry.count++;
		}

		// Cleanup old entries (simple garbage collection)
		this.cleanup();
	}

	/**
	 * Get remaining requests for user
	 * 
	 * @param userId - User ID to check
	 * @returns Number of remaining requests
	 */
	async getRemainingRequests(userId: string): Promise<number> {
		const result = await this.checkAIRateLimit(userId);
		return result.remaining;
	}

	/**
	 * Simple cleanup of expired entries
	 * Production: Use scheduled job with Redis TTL
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
