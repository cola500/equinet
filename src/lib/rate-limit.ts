/**
 * Production-ready rate limiter using Upstash Redis
 *
 * Uses Upstash Redis for serverless-compatible rate limiting.
 * Falls back to in-memory if Upstash credentials are not configured.
 *
 * IMPORTANT: For production deployment on Vercel, configure UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN in environment variables.
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * In-memory fallback for development (DO NOT USE IN PRODUCTION)
 */
interface RateLimitRecord {
  count: number
  resetAt: number
}

const inMemoryAttempts = new Map<string, RateLimitRecord>()

/**
 * Check if Upstash is configured
 */
const isUpstashConfigured = () => {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

/**
 * Initialize Upstash Redis client (lazy initialization)
 */
let redis: Redis | null = null
let upstashRateLimiters: Record<string, Ratelimit> | null = null

function getRedis(): Redis {
  if (!redis && isUpstashConfigured()) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  if (!redis) {
    throw new Error("Upstash Redis not configured")
  }
  return redis
}

/**
 * Get or create Upstash rate limiters (lazy initialization)
 */
function getUpstashRateLimiters(): Record<string, Ratelimit> {
  if (!upstashRateLimiters && isUpstashConfigured()) {
    const redisClient = getRedis()

    upstashRateLimiters = {
      login: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "15 m"),
        analytics: true,
        prefix: "ratelimit:login",
      }),
      registration: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "ratelimit:registration",
      }),
      api: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "ratelimit:api",
      }),
      passwordReset: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "ratelimit:password-reset",
      }),
      booking: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        analytics: true,
        prefix: "ratelimit:booking",
      }),
      profileUpdate: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(20, "1 h"),
        analytics: true,
        prefix: "ratelimit:profile-update",
      }),
      serviceCreate: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        analytics: true,
        prefix: "ratelimit:service-create",
      }),
      geocode: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: true,
        prefix: "ratelimit:geocode",
      }),
      resendVerification: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(3, "15 m"),
        analytics: true,
        prefix: "ratelimit:resend-verification",
      }),
      ai: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: true,
        prefix: "ratelimit:ai",
      }),
      loginIp: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(30, "15 m"),
        analytics: true,
        prefix: "ratelimit:login-ip",
      }),
    }
  }

  if (!upstashRateLimiters) {
    throw new Error("Upstash rate limiters not initialized")
  }

  return upstashRateLimiters
}

/**
 * In-memory rate limiter (fallback for development)
 */
function checkRateLimitInMemory(
  identifier: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const record = inMemoryAttempts.get(identifier)

  // No record or window expired - allow and create new record
  if (!record || now > record.resetAt) {
    inMemoryAttempts.set(identifier, { count: 1, resetAt: now + windowMs })
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
export async function resetRateLimit(
  identifier: string,
  limiterType: string = 'login'
): Promise<void> {
  // In-memory fallback
  inMemoryAttempts.delete(identifier)

  // Upstash: actually reset the sliding window
  if (isUpstashConfigured()) {
    try {
      const limiters = getUpstashRateLimiters()
      const limiter = limiters[limiterType]
      if (limiter) {
        await limiter.resetUsedTokens(identifier)
      }
    } catch (error) {
      console.error("Failed to reset Upstash rate limit:", error)
    }
  }
}

/**
 * Clear ALL in-memory rate limit state.
 * Used by E2E test setup to prevent rate limit accumulation across test runs.
 * Only affects in-memory fallback (no-op if Upstash is configured).
 */
export function clearAllInMemoryRateLimits(): void {
  inMemoryAttempts.clear()
}

/**
 * Cleanup expired entries for in-memory storage (run periodically)
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, value] of inMemoryAttempts.entries()) {
    if (now > value.resetAt) {
      inMemoryAttempts.delete(key)
    }
  }
}

// Cleanup every 5 minutes (only for in-memory fallback)
if (typeof setInterval !== 'undefined' && !isUpstashConfigured()) {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000)
}

/**
 * Check rate limit using Upstash or in-memory fallback
 *
 * @param limiterType - Type of rate limiter to use
 * @param identifier - Unique identifier (email, IP, user ID, etc)
 * @returns true if request is allowed, false if rate limited
 */
async function checkRateLimit(
  limiterType: keyof typeof rateLimiters,
  identifier: string
): Promise<boolean> {
  // Use Upstash if configured
  if (isUpstashConfigured()) {
    try {
      const limiters = getUpstashRateLimiters()
      const limiter = limiters[limiterType]

      if (!limiter) {
        console.error(`Rate limiter type "${limiterType}" not found`)
        return true // Fail open
      }

      const { success } = await limiter.limit(identifier)
      return success
    } catch (error) {
      console.error("Upstash rate limiter error:", error)
      // Fail open for availability (log but allow request)
      return true
    }
  }

  // Fallback to in-memory for development
  console.warn("⚠️  Using in-memory rate limiting (NOT suitable for production)")

  // Map limiter types to their configurations
  // Note: Higher limits in development/test to allow E2E test runs
  const configs: Record<string, { max: number; window: number }> = {
    login: { max: 15, window: 15 * 60 * 1000 },
    registration: { max: 50, window: 60 * 60 * 1000 },
    api: { max: 1000, window: 60 * 1000 },
    passwordReset: { max: 50, window: 60 * 60 * 1000 },
    booking: { max: 100, window: 60 * 60 * 1000 },
    profileUpdate: { max: 100, window: 60 * 60 * 1000 },
    serviceCreate: { max: 100, window: 60 * 60 * 1000 },
    geocode: { max: 100, window: 60 * 1000 },
    resendVerification: { max: 50, window: 15 * 60 * 1000 },
    ai: { max: 200, window: 60 * 1000 },
    loginIp: { max: 200, window: 15 * 60 * 1000 },
  }

  const config = configs[limiterType]
  if (!config) {
    console.error(`Rate limiter type "${limiterType}" not found in fallback`)
    return true // Fail open
  }

  return checkRateLimitInMemory(identifier, config.max, config.window)
}

/**
 * Get client IP address safely from request headers
 * Uses Vercel's trusted headers with validation
 *
 * @param request - The incoming request
 * @returns Client IP or 'unknown' if not available
 */
export function getClientIP(request: Request): string {
  // Vercel sets x-real-ip in serverless environment
  const realIp = request.headers.get("x-real-ip")
  if (realIp && isValidIP(realIp)) {
    return realIp
  }

  // Fallback to x-forwarded-for (first IP in chain)
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim()
    if (isValidIP(firstIp)) {
      return firstIp
    }
  }

  return "unknown"
}

/**
 * Validate IP address format to prevent header injection
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  // IPv6 simplified pattern (covers most cases)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Predefined rate limiters for common use cases
 *
 * IMPORTANT: These now return Promises and must be awaited
 */
export const rateLimiters = {
  /**
   * Login attempts: 5 attempts per 15 minutes
   */
  login: async (identifier: string) => checkRateLimit('login', identifier),

  /**
   * Registration: 3 attempts per hour
   */
  registration: async (identifier: string) => checkRateLimit('registration', identifier),

  /**
   * API requests: 100 requests per minute
   */
  api: async (identifier: string) => checkRateLimit('api', identifier),

  /**
   * Password reset: 3 attempts per hour
   */
  passwordReset: async (identifier: string) => checkRateLimit('passwordReset', identifier),

  /**
   * Booking creation: 10 bookings per hour per user
   */
  booking: async (identifier: string) => checkRateLimit('booking', identifier),

  /**
   * Profile updates: 20 updates per hour
   */
  profileUpdate: async (identifier: string) => checkRateLimit('profileUpdate', identifier),

  /**
   * Service creation: 10 services per hour
   */
  serviceCreate: async (identifier: string) => checkRateLimit('serviceCreate', identifier),

  /**
   * Geocoding: 30 requests per minute (expensive external API)
   */
  geocode: async (identifier: string) => checkRateLimit('geocode', identifier),

  /**
   * Resend verification email: 3 attempts per 15 minutes
   */
  resendVerification: async (identifier: string) => checkRateLimit('resendVerification', identifier),

  /**
   * AI/LLM calls: 20 requests per minute (cost protection)
   */
  ai: async (identifier: string) => checkRateLimit('ai', identifier),

  /**
   * Login attempts per IP: 30 attempts per 15 minutes (higher than per-email to handle shared IPs)
   */
  loginIp: async (identifier: string) => checkRateLimit('loginIp', identifier),
}
