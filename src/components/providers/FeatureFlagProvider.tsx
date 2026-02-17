"use client"

import { createContext, useContext, useState } from "react"

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
  const [flags] = useState(initialFlags)

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
