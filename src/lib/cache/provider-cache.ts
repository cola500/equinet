/**
 * Provider list cache using Upstash Redis
 *
 * Caches provider list results to:
 * - Reduce database load for frequently accessed provider lists
 * - Improve response times for geo-filtered searches
 * - Enable scaling to 500+ users
 *
 * Security:
 * - Cache keys are SHA-256 hashed to prevent injection
 * - TTL of 5 minutes (providers update more frequently than geo-data)
 */

import { Redis } from "@upstash/redis"
import crypto from "crypto"
import { ProviderWithDetails } from "@/infrastructure/persistence/provider/IProviderRepository"

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
function createCacheKey(filters: string): string {
  const hash = crypto.createHash("sha256").update(filters).digest("hex")
  return `providers:${hash.substring(0, 16)}` // Use first 16 chars for shorter keys
}

// Re-export type for consumers
export type CachedProvider = ProviderWithDetails

export interface CachedProviderResult {
  providers: CachedProvider[]
  cachedAt: string
}

/**
 * Get cached provider list
 *
 * @param filters - JSON-serialized filter parameters
 * @returns Cached result or null if not found/Redis unavailable
 */
export async function getCachedProviders(
  filters: string
): Promise<CachedProvider[] | null> {
  const client = getRedis()
  if (!client) {
    return null // Redis not configured, skip cache
  }

  try {
    const key = createCacheKey(filters)
    const cached = await client.get<CachedProviderResult>(key)
    return cached?.providers ?? null
  } catch (error) {
    console.error("[Provider Cache] Read error:", error)
    return null // Fail open - continue without cache
  }
}

/**
 * Store provider list in cache
 *
 * @param filters - JSON-serialized filter parameters
 * @param providers - Provider list to cache
 */
export async function setCachedProviders(
  filters: string,
  providers: CachedProvider[]
): Promise<void> {
  const client = getRedis()
  if (!client) {
    return // Redis not configured, skip cache
  }

  try {
    const key = createCacheKey(filters)
    const data: CachedProviderResult = {
      providers,
      cachedAt: new Date().toISOString(),
    }

    // TTL: 5 minutes (providers update more frequently than geo-data)
    const TTL_SECONDS = 5 * 60
    await client.setex(key, TTL_SECONDS, data)
  } catch (error) {
    console.error("[Provider Cache] Write error:", error)
    // Fail silently - caching is not critical
  }
}

/**
 * Invalidate all provider cache entries
 * Call this when a provider is created, updated, or deleted
 *
 * Note: Uses Upstash SCAN to find and delete all provider cache keys
 */
export async function invalidateProviderCache(): Promise<void> {
  const client = getRedis()
  if (!client) {
    return
  }

  try {
    // Scan for all provider cache keys and delete them
    // For MVP, we scan once with high count - sufficient for <500 providers
    const result = await client.scan(0, {
      match: "providers:*",
      count: 1000,
    })
    const keys = result[1]

    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch (error) {
    console.error("[Provider Cache] Invalidation error:", error)
    // Fail silently - cache will expire naturally
  }
}

/**
 * Check if provider cache is available
 * Useful for monitoring and health checks
 */
export function isProviderCacheAvailable(): boolean {
  return getRedis() !== null
}
