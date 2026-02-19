"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"

export const FEATURE_FLAGS_CHANGED_EVENT = "featureflags-changed"

const STALENESS_THRESHOLD_MS = 30_000

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
  const lastFetchedRef = useRef(Date.now())

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/feature-flags", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        // Bidirectional shallow-compare: detects added, removed, and changed flags
        setFlags((current) => {
          const next = data.flags as Record<string, boolean>
          const currentKeys = Object.keys(current)
          const nextKeys = Object.keys(next)
          if (currentKeys.length !== nextKeys.length) return next
          if (nextKeys.some((k) => next[k] !== current[k])) return next
          if (currentKeys.some((k) => !(k in next))) return next
          return current
        })
        lastFetchedRef.current = Date.now()
      }
    } catch {
      // Keep existing flags on network error
    }
  }, [])

  const refetchIfStale = useCallback(async () => {
    if (Date.now() - lastFetchedRef.current >= STALENESS_THRESHOLD_MS) {
      await refetch()
    }
  }, [refetch])

  // Re-fetch on window focus (e.g. after admin toggle in another tab) -- only if stale
  useEffect(() => {
    const onFocus = () => refetchIfStale()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refetchIfStale])

  // Re-fetch on custom event (e.g. admin toggle on same page) -- always
  useEffect(() => {
    const onChanged = () => refetch()
    window.addEventListener(FEATURE_FLAGS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(FEATURE_FLAGS_CHANGED_EVENT, onChanged)
  }, [refetch])

  // Poll every 60s as a safety net
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
