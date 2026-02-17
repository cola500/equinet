"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"

export const FEATURE_FLAGS_CHANGED_EVENT = "featureflags-changed"

interface FeatureFlagContextValue {
  flags: Record<string, boolean>
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: {},
})

interface FeatureFlagProviderProps {
  initialFlags: Record<string, boolean>
  children: React.ReactNode
}

export function FeatureFlagProvider({
  initialFlags,
  children,
}: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState(initialFlags)
  const pathname = usePathname()

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/feature-flags", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setFlags(data.flags)
      }
    } catch {
      // Behåll befintliga flaggor vid nätverksfel
    }
  }, [])

  // Re-fetch vid klient-navigation
  useEffect(() => {
    refetch()
  }, [pathname, refetch])

  // Re-fetch vid window-focus (t.ex. efter admin-toggle i annan tab)
  useEffect(() => {
    const onFocus = () => refetch()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refetch])

  // Re-fetch vid custom event (t.ex. admin-toggle på samma sida)
  useEffect(() => {
    const onChanged = () => refetch()
    window.addEventListener(FEATURE_FLAGS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(FEATURE_FLAGS_CHANGED_EVENT, onChanged)
  }, [refetch])

  // Polling var 60:e sekund som säkerhetsnät
  useEffect(() => {
    const interval = setInterval(refetch, 60_000)
    return () => clearInterval(interval)
  }, [refetch])

  return (
    <FeatureFlagContext.Provider value={{ flags }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

export function useFeatureFlag(key: string): boolean {
  const { flags } = useContext(FeatureFlagContext)
  return flags[key] ?? false
}

export function useFeatureFlags(): Record<string, boolean> {
  const { flags } = useContext(FeatureFlagContext)
  return flags
}
