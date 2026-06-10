/**
 * Matcher functions for Service Worker runtime caching.
 *
 * Extracted so they can be unit-tested independently of sw.ts,
 * which has side effects (creates Serwist instance, adds event listeners).
 */

/** Match /api/auth/session requests from the same origin */
export function authSessionMatcher({
  url: { pathname },
  sameOrigin,
}: {
  url: { pathname: string }
  sameOrigin: boolean
}): boolean {
  return sameOrigin && pathname === "/api/auth/session"
}

/** Match same-origin /api/* GET requests (for cache + connectivity notifier) */
export function apiCacheMatcher({
  url: { pathname },
  sameOrigin,
}: {
  url: { pathname: string }
  sameOrigin: boolean
}): boolean {
  return sameOrigin && pathname.startsWith("/api/")
}

/** Match /_next/static/ JS chunk requests from the same origin */
export function jsChunkMatcher({
  url: { pathname },
  sameOrigin,
}: {
  url: { pathname: string }
  sameOrigin: boolean
}): boolean {
  return sameOrigin && pathname.startsWith("/_next/static/") && pathname.endsWith(".js")
}

/**
 * Match cross-origin Stripe requests (Stripe.js CDN, API, 3DS/iframe hosts).
 *
 * These must bypass the service worker entirely: a cross-origin opaque `.js`
 * response otherwise falls into defaultCache's static-js rule (CacheFirst),
 * which can't handle opaque responses and fails with "no-response" — breaking
 * Stripe Elements. Same cross-origin pitfall as the Supabase Storage images rule.
 */
export function stripeMatcher({
  url,
}: {
  url: { hostname: string }
}): boolean {
  const host = url.hostname
  return (
    host === "stripe.com" ||
    host.endsWith(".stripe.com") ||
    host === "stripe.network" ||
    host.endsWith(".stripe.network")
  )
}
