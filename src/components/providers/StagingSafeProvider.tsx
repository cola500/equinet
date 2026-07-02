"use client"

import { createContext, useContext } from "react"

/**
 * Client-exposed mirror of the server-side isStagingSafe() signal
 * (src/lib/environment.ts → IS_LIVE_PRODUCTION !== "true").
 *
 * isStagingSafe() is server-only (reads a non-public env var), so client
 * components that must gate on "is this a non-production environment" — e.g. the
 * demo-entry buttons on the login page — read it here instead. Seeded once in the
 * root layout from the server value (SSR → context), same pattern as
 * DemoSessionProvider / FeatureFlagProvider. It is environment-fixed for the
 * page lifetime, so the context value follows the server prop directly (no
 * useState that could drift from a changed prop, no hydration mismatch).
 *
 * Default false = fail-safe: a component rendered without the provider is treated
 * as live production (no demo entry), never accidentally exposing demo buttons.
 */
const StagingSafeContext = createContext<boolean>(false)

interface StagingSafeProviderProps {
  initialStagingSafe: boolean
  children: React.ReactNode
}

export function StagingSafeProvider({
  initialStagingSafe,
  children,
}: StagingSafeProviderProps) {
  return (
    <StagingSafeContext.Provider value={initialStagingSafe}>
      {children}
    </StagingSafeContext.Provider>
  )
}

/** True when the runtime is NOT live production (staging/local/preview/test). */
export function useStagingSafe(): boolean {
  return useContext(StagingSafeContext)
}
