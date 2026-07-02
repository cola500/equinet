import { cookies } from "next/headers"
import { DEMO_SESSION_COOKIE, DEMO_SESSION_VALUE } from "./demo-session"

/**
 * Server-side: is the current request part of a demo session?
 *
 * Reads the per-session demo cookie set by the demo-login buttons. Used to seed
 * the DemoSessionProvider in the root layout (SSR → client context), mirroring
 * how getFeatureFlags() seeds FeatureFlagProvider.
 *
 * Server-only (imports next/headers). Client components read the value via
 * useDemoSession() instead.
 */
export async function readDemoSession(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE
}
