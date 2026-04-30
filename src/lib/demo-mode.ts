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
