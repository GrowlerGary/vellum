/**
 * Simple in-memory token-bucket rate limiter.
 *
 * Suitable for single-instance deployments (Docker Compose, single server).
 * For multi-instance setups, replace with a Redis-backed solution.
 *
 * Usage:
 *   if (!rateLimit(`search:${userId}`, 20, 60_000)) {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 *   }
 */

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 *
 * @param key        Unique key to identify the caller (e.g. `search:${userId}`)
 * @param maxRequests Maximum number of requests per window
 * @param windowMs   Window size in milliseconds
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.lastRefill > windowMs) {
    // New bucket or window has elapsed — reset
    buckets.set(key, { tokens: maxRequests - 1, lastRefill: now })
    return true
  }

  if (bucket.tokens > 0) {
    bucket.tokens--
    return true
  }

  return false
}

// Periodically clean up stale buckets to prevent unbounded memory growth.
// Runs every 5 minutes and removes buckets older than 10 minutes.
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(key)
    }
  }
}, 5 * 60 * 1000)
