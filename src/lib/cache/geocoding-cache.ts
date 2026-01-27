/**
 * Geocoding cache using Upstash Redis
 *
 * Caches geocoding results to:
 * - Avoid hitting Nominatim rate limit (1 req/s)
 * - Reduce latency for repeated lookups
 * - Enable scaling to 500+ users
 *
 * Security:
 * - Cache keys are SHA-256 hashed to prevent injection
 * - TTL of 30 days (addresses rarely change location)
 */

import { Redis } from "@upstash/redis"
import crypto from "crypto"

// Lazy initialization of Redis client
let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  redis = new Redis({ url, token })
  return redis
}

/**
 * Create a safe cache key using SHA-256 hash
 * This prevents cache key injection attacks
 */
function createCacheKey(address: string): string {
  const normalized = address.trim().toLowerCase()
  const hash = crypto.createHash("sha256").update(normalized).digest("hex")
  return `geocode:${hash.substring(0, 16)}` // Use first 16 chars for shorter keys
}

export interface CachedGeocodingResult {
  latitude: number
  longitude: number
  cachedAt: string
}

/**
 * Get cached geocoding result
 *
 * @param address - The address to look up
 * @returns Cached result or null if not found/Redis unavailable
 */
export async function getCachedGeocode(
  address: string
): Promise<CachedGeocodingResult | null> {
  const client = getRedis()
  if (!client) {
    return null // Redis not configured, skip cache
  }

  try {
    const key = createCacheKey(address)
    const cached = await client.get<CachedGeocodingResult>(key)
    return cached
  } catch (error) {
    console.error("[Geocoding Cache] Read error:", error)
    return null // Fail open - continue without cache
  }
}

/**
 * Store geocoding result in cache
 *
 * @param address - The address that was geocoded
 * @param latitude - Resulting latitude
 * @param longitude - Resulting longitude
 */
export async function setCachedGeocode(
  address: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const client = getRedis()
  if (!client) {
    return // Redis not configured, skip cache
  }

  try {
    const key = createCacheKey(address)
    const data: CachedGeocodingResult = {
      latitude,
      longitude,
      cachedAt: new Date().toISOString(),
    }

    // TTL: 30 days (addresses don't change location often)
    const TTL_SECONDS = 30 * 24 * 60 * 60
    await client.setex(key, TTL_SECONDS, data)
  } catch (error) {
    console.error("[Geocoding Cache] Write error:", error)
    // Fail silently - caching is not critical
  }
}

/**
 * Check if geocoding cache is available
 * Useful for monitoring and health checks
 */
export function isGeocodingCacheAvailable(): boolean {
  return getRedis() !== null
}
