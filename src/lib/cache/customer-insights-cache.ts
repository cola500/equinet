/**
 * Customer insights cache using Upstash Redis
 *
 * Caches AI-generated customer insights to:
 * - Avoid redundant LLM calls for unchanged customer data
 * - Reduce cost (each AI call ~$0.01)
 * - Improve response times (~5ms cached vs ~1500ms AI)
 *
 * TTL: 6 hours (customer data changes infrequently)
 *
 * Pattern copied from provider-cache.ts
 */

import { Redis } from "@upstash/redis"
import crypto from "crypto"
import type {
  CustomerInsight,
  CustomerMetrics,
} from "@/domain/customer-insight/CustomerInsightService"
import { logger } from "@/lib/logger"

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

/** TTL: 6 hours */
const TTL_SECONDS = 6 * 60 * 60 // 21600

/**
 * Create a safe cache key using SHA-256 hash.
 * Prevents cache key injection attacks.
 */
function createCacheKey(providerId: string, customerId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${providerId}:${customerId}`)
    .digest("hex")
  return `insights:${hash.substring(0, 16)}`
}

export interface CachedInsightData {
  insight: CustomerInsight
  metrics: CustomerMetrics
  cachedAt: string
}

/**
 * Get cached customer insight.
 *
 * @returns Cached data or null if not found / Redis unavailable
 */
export async function getCachedInsight(
  providerId: string,
  customerId: string
): Promise<CachedInsightData | null> {
  const client = getRedis()
  if (!client) {
    return null
  }

  try {
    const key = createCacheKey(providerId, customerId)
    const cached = await client.get<CachedInsightData>(key)
    return cached ?? null
  } catch (error) {
    logger.error(
      "[Insights Cache] Read error",
      error instanceof Error ? error : new Error(String(error))
    )
    return null // Fail open
  }
}

/**
 * Store customer insight in cache.
 */
export async function setCachedInsight(
  providerId: string,
  customerId: string,
  data: { insight: CustomerInsight; metrics: CustomerMetrics }
): Promise<void> {
  const client = getRedis()
  if (!client) {
    return
  }

  try {
    const key = createCacheKey(providerId, customerId)
    const cacheEntry: CachedInsightData = {
      ...data,
      cachedAt: new Date().toISOString(),
    }
    await client.setex(key, TTL_SECONDS, cacheEntry)
  } catch (error) {
    logger.error(
      "[Insights Cache] Write error",
      error instanceof Error ? error : new Error(String(error))
    )
    // Fail silently -- caching is not critical
  }
}

/**
 * Invalidate a single customer insight cache entry.
 */
export async function invalidateCustomerInsight(
  providerId: string,
  customerId: string
): Promise<void> {
  const client = getRedis()
  if (!client) {
    return
  }

  try {
    const key = createCacheKey(providerId, customerId)
    await client.del(key)
  } catch (error) {
    logger.error(
      "[Insights Cache] Invalidation error",
      error instanceof Error ? error : new Error(String(error))
    )
    // Fail silently -- cache will expire naturally
  }
}
