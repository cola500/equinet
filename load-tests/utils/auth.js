/* eslint-disable no-undef */
/**
 * Auth helper for k6 load tests.
 *
 * Usage:
 *   export LOAD_TEST_SESSION_COOKIE="next-auth.session-token=abc123..."
 *   k6 run load-tests/scenarios/provider-dashboard.js
 *
 * How to get a session cookie:
 *   1. Log in to the app in your browser
 *   2. Open DevTools > Application > Cookies
 *   3. Copy the value of "next-auth.session-token"
 *   4. Export as: export LOAD_TEST_SESSION_COOKIE="next-auth.session-token=<value>"
 */

/**
 * Returns request params with session cookie for authenticated endpoints.
 * Falls back to empty cookies if env var is not set.
 */
export function getAuthParams() {
  const cookie = __ENV.LOAD_TEST_SESSION_COOKIE || ""
  return {
    headers: {
      Cookie: cookie,
    },
  }
}

/**
 * Base URL for the target server.
 * Override with: export LOAD_TEST_BASE_URL="https://equinet.vercel.app"
 */
export function getBaseUrl() {
  return __ENV.LOAD_TEST_BASE_URL || "http://localhost:3000"
}
