/**
 * Simple in-memory rate limiter
 *
 * NOTE: This is suitable for development and small-scale production.
 * For larger production deployments, use Redis-based rate limiting
 * like @upstash/ratelimit or similar.
 */

interface RateLimitRecord {
  count: number
  resetAt: number
}

const attempts = new Map<string, RateLimitRecord>()

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (email, IP, etc)
 * @param maxAttempts - Maximum number of attempts allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const record = attempts.get(identifier)

  // No record or window expired - allow and create new record
  if (!record || now > record.resetAt) {
    attempts.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  // Check if max attempts exceeded
  if (record.count >= maxAttempts) {
    return false
  }

  // Increment count and allow
  record.count++
  return true
}

/**
 * Reset rate limit for an identifier (e.g., after successful login)
 */
export function resetRateLimit(identifier: string): void {
  attempts.delete(identifier)
}

/**
 * Get remaining attempts for an identifier
 */
export function getRemainingAttempts(
  identifier: string,
  maxAttempts: number
): number {
  const record = attempts.get(identifier)
  if (!record || Date.now() > record.resetAt) {
    return maxAttempts
  }
  return Math.max(0, maxAttempts - record.count)
}

/**
 * Cleanup expired entries (run periodically)
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, value] of attempts.entries()) {
    if (now > value.resetAt) {
      attempts.delete(key)
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000)
}

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  /**
   * Login attempts: 5 attempts per 15 minutes
   */
  login: (identifier: string) => checkRateLimit(identifier, 5, 15 * 60 * 1000),

  /**
   * Registration: 3 attempts per hour
   */
  registration: (identifier: string) => checkRateLimit(identifier, 3, 60 * 60 * 1000),

  /**
   * API requests: 100 requests per minute
   */
  api: (identifier: string) => checkRateLimit(identifier, 100, 60 * 1000),

  /**
   * Password reset: 3 attempts per hour
   */
  passwordReset: (identifier: string) => checkRateLimit(identifier, 3, 60 * 60 * 1000),

  /**
   * Booking creation: 10 bookings per hour per user
   */
  booking: (identifier: string) => checkRateLimit(identifier, 10, 60 * 60 * 1000),

  /**
   * Profile updates: 20 updates per hour
   */
  profileUpdate: (identifier: string) => checkRateLimit(identifier, 20, 60 * 60 * 1000),

  /**
   * Service creation: 10 services per hour
   */
  serviceCreate: (identifier: string) => checkRateLimit(identifier, 10, 60 * 60 * 1000),
}
