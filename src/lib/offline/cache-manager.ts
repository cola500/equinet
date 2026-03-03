import { offlineDb } from "./db"
import { debugLog } from "./debug-logger"

/** Maximum cache age: 4 hours (providers may be offline for extended periods) */
export const MAX_AGE_MS = 4 * 60 * 60 * 1000

// -- Bookings --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheBookings(bookings: any[]): Promise<void> {
  const now = Date.now()
  await offlineDb.bookings.clear()
  await offlineDb.bookings.bulkPut(
    bookings.map((b) => ({ id: b.id ?? "all", data: b, cachedAt: now }))
  )
  await offlineDb.metadata.put({
    key: "bookings",
    lastSyncedAt: now,
    version: 1,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedBookings(): Promise<any[] | null> {
  const meta = await offlineDb.metadata.get("bookings")
  if (!meta || Date.now() - meta.lastSyncedAt > MAX_AGE_MS) {
    return null
  }
  const records = await offlineDb.bookings.toArray()
  const valid = records.filter((r) => isValidCachedData(r.data))
  if (valid.length === 0) return null
  return valid.map((r) => r.data)
}

// -- Routes --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheRoutes(routes: any[]): Promise<void> {
  const now = Date.now()
  await offlineDb.routes.clear()
  await offlineDb.routes.bulkPut(
    routes.map((r) => ({ id: r.id ?? "all", data: r, cachedAt: now }))
  )
  await offlineDb.metadata.put({
    key: "routes",
    lastSyncedAt: now,
    version: 1,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedRoutes(): Promise<any[] | null> {
  const meta = await offlineDb.metadata.get("routes")
  if (!meta || Date.now() - meta.lastSyncedAt > MAX_AGE_MS) {
    return null
  }
  const records = await offlineDb.routes.toArray()
  const valid = records.filter((r) => isValidCachedData(r.data))
  if (valid.length === 0) return null
  return valid.map((r) => r.data)
}

// -- Profile --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheProfile(profile: any): Promise<void> {
  const now = Date.now()
  await offlineDb.profile.put({
    id: "profile",
    data: profile,
    cachedAt: now,
  })
  await offlineDb.metadata.put({
    key: "profile",
    lastSyncedAt: now,
    version: 1,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedProfile(): Promise<any | null> {
  const meta = await offlineDb.metadata.get("profile")
  if (!meta || Date.now() - meta.lastSyncedAt > MAX_AGE_MS) {
    return null
  }
  const record = await offlineDb.profile.get("profile")
  if (!record) return null
  return record.data
}

// -- Quota recovery --

function isQuotaError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.code === 22 // Safari
  }
  return String(error).includes("QuotaExceededError")
}

async function withQuotaRecovery(operation: () => Promise<void>): Promise<void> {
  try {
    await operation()
  } catch (error) {
    if (isQuotaError(error)) {
      debugLog("sync", "warn", "Quota exceeded, evicting stale cache")
      await evictStaleCache()
      try {
        await operation()
      } catch {
        debugLog("sync", "error", "Quota still exceeded after eviction")
      }
      return
    }
    throw error
  }
}

// -- Generic endpoint cache --

/** Cache any endpoint response by full URL (including query string) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheEndpoint(url: string, data: any): Promise<void> {
  const now = Date.now()
  await withQuotaRecovery(() => offlineDb.endpointCache.put({ url, data, cachedAt: now }).then(() => {}))
}

/**
 * Get cached endpoint response.
 * 1. Try exact URL match first
 * 2. If URL has query params and no exact match, fall back to base URL (strip query)
 * 3. Return null if nothing found or stale
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedEndpoint(url: string): Promise<any | null> {
  const now = Date.now()

  // Try exact match
  const exact = await offlineDb.endpointCache.get(url)
  if (exact && now - exact.cachedAt <= MAX_AGE_MS) {
    if (!isValidCachedData(exact.data)) return null
    return exact.data
  }

  // Fallback: strip query and try base URL
  const qIndex = url.indexOf("?")
  if (qIndex > 0) {
    const baseUrl = url.substring(0, qIndex)
    const base = await offlineDb.endpointCache.get(baseUrl)
    if (base && now - base.cachedAt <= MAX_AGE_MS) {
      if (!isValidCachedData(base.data)) return null
      return base.data
    }
  }

  return null
}

/** Invalidate all cached entries whose URL starts with the given prefix */
export async function invalidateEndpointCache(urlPrefix: string): Promise<void> {
  const allEntries = await offlineDb.endpointCache.toArray()
  const keysToDelete = allEntries
    .filter((e) => e.url === urlPrefix || e.url.startsWith(urlPrefix + "?"))
    .map((e) => e.url)
  if (keysToDelete.length > 0) {
    await offlineDb.endpointCache.bulkDelete(keysToDelete)
  }
}

// -- Validation --

/** Lightweight check that cached data is not null/undefined */
function isValidCachedData(data: unknown): boolean {
  return data !== null && data !== undefined
}

// -- Stats --

export interface CacheStats {
  totalEntries: number
  oldestEntryAge: number
  pendingMutations: number
  estimatedSizeBytes: number
}

export async function getCacheStats(): Promise<CacheStats> {
  const entries = await offlineDb.endpointCache.toArray()
  const pendingMutations = await offlineDb.pendingMutations
    .where("status")
    .anyOf("pending", "failed")
    .count()

  const now = Date.now()
  let oldestAge = 0
  let estimatedSize = 0

  for (const entry of entries) {
    const age = now - entry.cachedAt
    if (age > oldestAge) oldestAge = age
    estimatedSize += JSON.stringify(entry.data).length * 2 // rough UTF-16 estimate
  }

  return {
    totalEntries: entries.length,
    oldestEntryAge: oldestAge,
    pendingMutations,
    estimatedSizeBytes: estimatedSize,
  }
}

// -- Stale cache eviction --

/** Remove all endpoint cache entries older than MAX_AGE_MS. */
export async function evictStaleCache(): Promise<number> {
  const now = Date.now()
  const allEntries = await offlineDb.endpointCache.toArray()
  const staleKeys = allEntries.filter((e) => now - e.cachedAt > MAX_AGE_MS).map((e) => e.url)
  if (staleKeys.length > 0) {
    await offlineDb.endpointCache.bulkDelete(staleKeys)
    debugLog("sync", "info", `Evicted ${staleKeys.length} stale cache entries`)
  }
  return staleKeys.length
}

/** Throttled eviction -- max once per 5 minutes. */
let lastEvictionTime = 0
const EVICTION_THROTTLE_MS = 5 * 60 * 1000

export async function maybeEvictStaleCache(): Promise<void> {
  const now = Date.now()
  if (now - lastEvictionTime < EVICTION_THROTTLE_MS) return
  lastEvictionTime = now
  await evictStaleCache()
}

/** Reset eviction throttle. Test-only. */
export function _resetEvictionThrottle(): void {
  lastEvictionTime = 0
}

// -- Cleanup --

export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    offlineDb.bookings.clear(),
    offlineDb.routes.clear(),
    offlineDb.profile.clear(),
    offlineDb.metadata.clear(),
    offlineDb.endpointCache.clear(),
    offlineDb.pendingMutations.clear(),
  ])
}
