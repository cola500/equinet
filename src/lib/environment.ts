/**
 * Environment-safety signal — decoupled from demo presentation.
 *
 * `isStagingSafe()` answers a single question: "should this environment be
 * shielded from the outside world?" — i.e. block real outbound email/push,
 * no-op destructive deletes on seed data, and keep crawlers out.
 *
 * It is driven purely by the deployment environment (`VERCEL_ENV`), NOT by
 * whether the current session is a demo session. This is the deliberate
 * decoupling from `isDemoMode()`: on staging we never want to send real
 * email/push regardless of whether a normal test user or demo-Lisa is logged
 * in, while demo *presentation* (nav, hidden pages, demo-login) is a separate
 * concern handled elsewhere.
 *
 * - `production` (`VERCEL_ENV === "production"`) → NOT safe (real side effects
 *   allowed; this is the live product).
 * - everything else (`preview`/staging, `development`, and unset/local/test)
 *   → SAFE.
 *
 * Defaulting to "safe" when `VERCEL_ENV` is missing is intentional and
 * fail-safe: a misconfigured or local environment must never accidentally
 * send real email/push or expose itself to crawlers. Only an explicit
 * `production` value opts into real-world side effects.
 */
export function isStagingSafe(): boolean {
  return process.env.VERCEL_ENV !== "production"
}
