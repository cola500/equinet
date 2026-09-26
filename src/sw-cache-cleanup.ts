import { PAGES_CACHE_NAME } from "@serwist/next/worker"

/**
 * Cache names that can hold per-user data: the cached auth session, cached
 * /api/* GET responses (bookings, customers, messages, ...), and rendered
 * HTML/RSC for authenticated routes.
 *
 * Single source of truth so sw.ts's runtime-caching rules and the cleanup
 * logic below can never drift apart.
 */
export const AUTH_SESSION_CACHE_NAME = "auth-session"
export const API_CACHE_NAME = "apis"

/**
 * Every cache that may contain per-user data. Deliberately excludes the
 * app-shell precache, static JS/CSS/image caches and "supabase-images" --
 * none of those hold user-specific responses, and offline support depends on
 * keeping them intact.
 */
export const USER_DATA_CACHE_NAMES: readonly string[] = [
  AUTH_SESSION_CACHE_NAME,
  API_CACHE_NAME,
  PAGES_CACHE_NAME.html,
  PAGES_CACHE_NAME.rsc,
  PAGES_CACHE_NAME.rscPrefetch,
]

/**
 * Delete every user-data cache. Safe to call anytime and repeatedly -- all of
 * them are populated with NetworkFirst, so losing an entry just costs one
 * extra network round-trip on the next request.
 *
 * Called from two places:
 * - sw.ts's `activate` handler, unconditionally, on every service worker
 *   update. Covers browsers that already cached a previous user's data
 *   before this cleanup existed.
 * - sw.ts's `message` handler, on demand, when the client asks for it after
 *   logout. Covers a same-browser handoff between two users with no SW
 *   update in between.
 */
export async function clearUserDataCaches(cacheStorage: CacheStorage = caches): Promise<void> {
  await Promise.all(USER_DATA_CACHE_NAMES.map((name) => cacheStorage.delete(name)))
}
