/**
 * Provider stats cache using Upstash Redis
 *
 * Caches provider insights and dashboard stats to:
 * - Reduce database load for analytics endpoints (2-3 heavy queries each)
 * - Improve response times for dashboard and insights pages
 *
 * TTL:
 * - Insights: 10 min (historical data, changes slowly)
 * - Dashboard stats: 5 min (8-week window, changes more frequently)
 *
 * Pattern copied from customer-insights-cache.ts
 */

import { Redis } from "@upstash/redis"
import crypto from "crypto"
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

/** TTL: 10 minutes for insights */
const INSIGHTS_TTL_SECONDS = 10 * 60

/** TTL: 5 minutes for dashboard stats */
const DASHBOARD_STATS_TTL_SECONDS = 5 * 60

/**
 * Create a safe cache key using SHA-256 hash.
 * Prevents cache key injection attacks.
 */
function createCacheKey(prefix: string, input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest("hex")
  return `${prefix}:${hash.substring(0, 16)}`
}

// --- Provider Insights ---

export async function getCachedProviderInsights(
  providerId: string,
  months: number
): Promise<Record<string, unknown> | null> {
  const client = getRedis()
  if (!client) {
    return null
  }

  try {
    const key = createCacheKey("provider-insights", `${providerId}:${months}`)
    const cached = await client.get<Record<string, unknown>>(key)
    return cached ?? null
  } catch (error) {
    logger.error(
      "[Provider Stats Cache] Insights read error",
      error instanceof Error ? error : new Error(String(error))
    )
    return null // Fail open
  }
}

export async function setCachedProviderInsights(
  providerId: string,
  months: number,
  data: Record<string, unknown>
): Promise<void> {
  const client = getRedis()
  if (!client) {
    return
  }

  try {
    const key = createCacheKey("provider-insights", `${providerId}:${months}`)
    await client.setex(key, INSIGHTS_TTL_SECONDS, data)
  } catch (error) {
    logger.error(
      "[Provider Stats Cache] Insights write error",
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

// --- Dashboard Stats ---

export async function getCachedDashboardStats(
  providerId: string
): Promise<Record<string, unknown> | null> {
  const client = getRedis()
  if (!client) {
    return null
  }

  try {
    const key = createCacheKey("dashboard-stats", providerId)
    const cached = await client.get<Record<string, unknown>>(key)
    return cached ?? null
  } catch (error) {
    logger.error(
      "[Provider Stats Cache] Dashboard read error",
      error instanceof Error ? error : new Error(String(error))
    )
    return null // Fail open
  }
}

export async function setCachedDashboardStats(
  providerId: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = getRedis()
  if (!client) {
    return
  }

  try {
    const key = createCacheKey("dashboard-stats", providerId)
    await client.setex(key, DASHBOARD_STATS_TTL_SECONDS, data)
  } catch (error) {
    logger.error(
      "[Provider Stats Cache] Dashboard write error",
      error instanceof Error ? error : new Error(String(error))
    )
  }
}
