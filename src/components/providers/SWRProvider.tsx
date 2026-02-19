"use client"

import { SWRConfig } from "swr"
import { fetcher } from "@/lib/swr"
import { offlineAwareFetcher } from "@/lib/offline/offline-fetcher"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

/**
 * Global SWR configuration wrapper.
 *
 * - revalidateOnFocus: disabled to prevent visual flicker on tab switch
 * - dedupingInterval: deduplicates identical requests within 5 seconds
 * - errorRetryCount: retries failed requests up to 2 times
 * - fetcher: uses offline-aware fetcher when offline_mode flag is enabled
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  const isOfflineEnabled = useFeatureFlag("offline_mode")
  const activeFetcher = isOfflineEnabled ? offlineAwareFetcher : fetcher

  return (
    <SWRConfig
      value={{
        fetcher: activeFetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  )
}
