/**
 * In-memory rate limiter for API routes.
 *
 * Works on a per-key (e.g. IP address or user ID) basis with a sliding
 * window. Since each Vercel serverless function is a separate process,
 * this resets on cold starts — suitable for light abuse-prevention,
 * not for hard enforcement.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check whether a key is within its rate limit.
 *
 * @param key        Unique identifier (e.g. IP + route)
 * @param max        Max requests allowed in the window
 * @param windowMs   Window duration in milliseconds
 * @returns          `true` if the request is allowed, `false` if blocked
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}

/**
 * Returns headers to include in rate-limited responses so clients
 * can see their current quota.
 */
export function rateLimitHeaders(
  key: string,
  max: number
): Record<string, string> {
  const entry = store.get(key);
  if (!entry) return {};
  const remaining = Math.max(0, max - entry.count);
  const reset = Math.ceil(entry.resetAt / 1000);
  return {
    "X-RateLimit-Limit":     String(max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset":     String(reset),
  };
}
