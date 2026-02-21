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
