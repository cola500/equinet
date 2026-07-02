/**
 * Environment-safety signal for outbound/destructive side effects.
 *
 * Separates *environment safety* (block real email/push, no-op destructive
 * DELETE, noindex) from *demo presentation* (nav, hidden pages, demo login).
 * Previously both were conflated under NEXT_PUBLIC_DEMO_MODE — see
 * docs/ideas/epic-prodlik-staging-demo-per-session.md.
 *
 * The signal is an EXPLICIT POSITIVE production opt-in, NOT a VERCEL_ENV check.
 *
 * Why not VERCEL_ENV? Production (`equinet-app`) and staging
 * (`equinet-staging-app`) are separate Vercel projects, and staging deploys the
 * `staging` branch as its *production target* — so BOTH report
 * VERCEL_ENV="production". No comparison on that variable can tell them apart.
 * PR #419 tried `VERCEL_ENV !== "production"` and accidentally unblocked real
 * email/push and made staging indexable; it was reverted in #420. See the memory
 * note `reference-staging-vercel-env-is-production`.
 *
 * Fail-safe by design: a missing, empty, or non-"true" value means SAFE. Only
 * the single real production project sets IS_LIVE_PRODUCTION="true" to opt into
 * real side effects. A misconfigured or new environment is never accidentally
 * unsafe.
 */

/**
 * True when the runtime must stay safe against the outside world: block real
 * email/push, no-op destructive demo-data deletion, disallow SEO indexing.
 *
 * - Missing / empty / any value ≠ "true"  → safe (staging, local, test, CI).
 * - IS_LIVE_PRODUCTION === "true"          → NOT safe (real production only).
 *
 * Server-side only: all current call-sites run on the server. Do NOT make this
 * NEXT_PUBLIC_* — that would inline it at build time and defeat the per-runtime
 * intent.
 */
export function isStagingSafe(): boolean {
  return process.env.IS_LIVE_PRODUCTION !== "true"
}
