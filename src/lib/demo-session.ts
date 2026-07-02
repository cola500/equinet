/**
 * Demo SESSION (per-session presentation signal).
 *
 * Separates *demo presentation* (nav, hidden pages, redirects) from *build-time
 * demo mode* (NEXT_PUBLIC_DEMO_MODE) and from *environment safety*
 * (isStagingSafe / IS_LIVE_PRODUCTION). See
 * docs/ideas/epic-prodlik-staging-demo-per-session.md.
 *
 * A demo session is opted into per browser session via a cookie, set when a
 * user enters through a demo-login button and cleared on logout. Unlike
 * NEXT_PUBLIC_DEMO_MODE (inlined at build time → whole build is demo), this lets
 * a normal login on staging see the real, prod-like product while the demo
 * buttons still deliver the demo experience.
 *
 * This module is client-safe (no next/headers). Server-side reading lives in
 * demo-session-server.ts so client components can import the constant/helpers
 * without pulling a server-only dependency.
 */

/** Name of the cookie that flags a per-session demo experience. */
export const DEMO_SESSION_COOKIE = "equinet-demo"

/** Cookie value that opts a session into demo presentation. */
export const DEMO_SESSION_VALUE = "true"

/**
 * Client-side: opt the current browser session into demo presentation.
 *
 * Session cookie (no expiry) so it clears when the browser closes; scoped to the
 * whole site and SameSite=Lax so it is sent with same-site RSC refreshes. Not
 * HTTP-only by design — this is a UX flag, not a security token, and setting it
 * from the client keeps the demo-login flow entirely client-side.
 */
export function setDemoSessionCookie(): void {
  document.cookie = `${DEMO_SESSION_COOKIE}=${DEMO_SESSION_VALUE}; path=/; SameSite=Lax`
}

/** Client-side: clear the demo-session cookie (called on logout). */
export function clearDemoSessionCookie(): void {
  document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`
}
