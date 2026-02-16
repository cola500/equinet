"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

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

  const fetchFlags = useCallback(() => {
    fetch("/api/feature-flags")
      .then((res) => {
        if (!res.ok) return
        return res.json()
      })
      .then((data) => {
        if (data?.flags) {
          setFlags(data.flags)
        }
      })
      .catch(() => {})
  }, [])

  // Re-fetch on navigation
  useEffect(() => {
    fetchFlags()
  }, [pathname, fetchFlags])

  // Re-fetch when window regains focus
  useEffect(() => {
    const handleFocus = () => fetchFlags()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [fetchFlags])

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
