/**
 * Demo mode utility.
 *
 * Demo mode is controlled solely by the environment/config variable
 * NEXT_PUBLIC_DEMO_MODE (staging=true, production=false). It is NOT a feature flag
 * — there is no demo_mode row in feature_flags and no admin toggle.
 *
 * isDemoMode() is a cheap, synchronous check that works on both server and client
 * (NEXT_PUBLIC_ vars are inlined at build time).
 */

/**
 * Check the demo-mode env variable (synchronous, works everywhere).
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true"
}

/**
 * @deprecated Demo mode is now controlled solely by NEXT_PUBLIC_DEMO_MODE (env/config),
 * not by a feature flag. This wrapper is kept for call-site compatibility and ignores
 * its argument — prefer isDemoMode() directly.
 */
export function isDemoModeWithFlags(_flags?: Record<string, boolean>): boolean {
  return isDemoMode()
}

/**
 * Provider routes visible in demo mode.
 * Everything else is hidden from navigation.
 */
export const DEMO_ALLOWED_PATHS = [
  "/provider/dashboard",
  "/provider/calendar",
  "/provider/bookings",
  "/provider/customers",
  "/provider/services",
  "/provider/insights",
  "/provider/messages",
  "/provider/profile",
  "/provider/help",
] as const

/**
 * Demo navigation — single source of truth shared by the desktop top-nav
 * (ProviderNav) and the mobile bottom bar (BottomTabBar) so both surfaces show
 * the SAME primary set in the SAME order. Order matters.
 *
 * Primary surfaces (the daily workspace); everything else lives under "Mer".
 * Every path here must also be in DEMO_ALLOWED_PATHS (no dead links).
 */
export const DEMO_PRIMARY_PATHS = [
  "/provider/calendar",
  "/provider/customers",
  "/provider/services",
  "/provider/messages",
] as const

export const DEMO_MORE_PATHS = [
  "/provider/dashboard",
  "/provider/bookings",
  "/provider/insights",
  "/provider/profile",
  "/provider/help",
] as const
