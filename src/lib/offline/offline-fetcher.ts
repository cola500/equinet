import {
  cacheBookings,
  getCachedBookings,
  cacheRoutes,
  getCachedRoutes,
  cacheProfile,
  getCachedProfile,
} from "./cache-manager"

/** Endpoints whose responses are cached in IndexedDB for offline access */
export const CACHEABLE_ENDPOINTS = [
  "/api/bookings",
  "/api/routes/my-routes",
  "/api/provider/profile",
] as const

type CacheableEndpoint = (typeof CACHEABLE_ENDPOINTS)[number]

function isCacheable(url: string): url is CacheableEndpoint {
  return CACHEABLE_ENDPOINTS.some((ep) => url === ep || url.startsWith(ep + "?"))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCacheReader(url: string): (() => Promise<any | null>) | null {
  if (url === "/api/bookings" || url.startsWith("/api/bookings?"))
    return getCachedBookings
  if (url === "/api/routes/my-routes" || url.startsWith("/api/routes/my-routes?"))
    return getCachedRoutes
  if (url === "/api/provider/profile" || url.startsWith("/api/provider/profile?"))
    return getCachedProfile
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCacheWriter(url: string): ((data: any) => Promise<void>) | null {
  if (url === "/api/bookings" || url.startsWith("/api/bookings?"))
    return cacheBookings
  if (url === "/api/routes/my-routes" || url.startsWith("/api/routes/my-routes?"))
    return cacheRoutes
  if (url === "/api/provider/profile" || url.startsWith("/api/provider/profile?"))
    return cacheProfile
  return null
}

/**
 * Network-first, cache-fallback fetcher for SWR.
 *
 * 1. Try network fetch
 * 2. On success: return data + write to IndexedDB (fire-and-forget)
 * 3. On failure: read from IndexedDB cache (if fresh, <4h)
 * 4. No cache: throw error (SWR shows error state)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function offlineAwareFetcher(url: string): Promise<any> {
  try {
    // 1. Try network
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error("API request failed")
    }
    const data = await res.json()

    // 2. Write-through to IndexedDB (fire-and-forget)
    if (isCacheable(url)) {
      const writer = getCacheWriter(url)
      if (writer) {
        writer(data).catch(() => {
          // Silently fail -- cache write is best-effort
        })
      }
    }

    return data
  } catch (networkError) {
    // 3. Network failed -- try cache fallback
    if (isCacheable(url)) {
      const reader = getCacheReader(url)
      if (reader) {
        const cached = await reader()
        if (cached !== null) {
          return cached
        }
      }
    }

    // 4. No cache available
    throw networkError
  }
}
