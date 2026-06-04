/**
 * Demo mode utility.
 *
 * Can be activated in two ways (either is sufficient):
 * 1. Env variable: NEXT_PUBLIC_DEMO_MODE=true (or FEATURE_DEMO_MODE=true)
 * 2. Feature flag: demo_mode (via admin panel or database)
 *
 * isDemoMode() is a cheap, synchronous check for the env variable.
 * Components that have access to feature flags should also check
 * flags.demo_mode for the database-backed flag.
 */

/**
 * Check env variable (synchronous, works everywhere).
 * For the full check including database flag, use isDemoModeWithFlags().
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true"
}

/**
 * Check both env variable and feature flag record.
 * Use this in components that already have access to flags from useFeatureFlags().
 */
export function isDemoModeWithFlags(flags: Record<string, boolean>): boolean {
  return isDemoMode() || flags.demo_mode === true
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
