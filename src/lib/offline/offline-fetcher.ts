import { cacheEndpoint, getCachedEndpoint } from "./cache-manager"
import {
  reportConnectivityLoss,
  reportConnectivityRestored,
} from "@/hooks/useOnlineStatus"

/** Endpoints whose responses are cached in IndexedDB for offline access */
export const CACHEABLE_ENDPOINTS = [
  "/api/bookings",
  "/api/routes/my-routes",
  "/api/provider/profile",
  "/api/services",
  "/api/provider/customers",
] as const

/** Dynamic URL patterns that are also cacheable (matched via regex) */
const CACHEABLE_PATTERNS = [
  /^\/api\/providers\/[^/]+\/availability-exceptions/,
]

function isCacheable(url: string): boolean {
  const baseUrl = url.split("?")[0]
  if (CACHEABLE_ENDPOINTS.some((ep) => url === ep || url.startsWith(ep + "?"))) {
    return true
  }
  return CACHEABLE_PATTERNS.some((pattern) => pattern.test(baseUrl))
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

    // Network succeeded -- restore connectivity state (iOS fix)
    reportConnectivityRestored()

    // 2. Write-through to IndexedDB (fire-and-forget)
    if (isCacheable(url)) {
      cacheEndpoint(url, data).catch(() => {
        // Silently fail -- cache write is best-effort
      })
    }

    return data
  } catch (networkError) {
    // Report actual connectivity loss (navigator.onLine is unreliable on iOS)
    if (networkError instanceof TypeError) {
      reportConnectivityLoss()
    }

    // 3. Network failed -- try cache fallback
    if (isCacheable(url)) {
      const cached = await getCachedEndpoint(url)
      if (cached !== null) {
        return cached
      }
    }

    // 4. No cache available
    throw networkError
  }
}
