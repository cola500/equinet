"use client"

import { SWRConfig } from "swr"
import { fetcher } from "@/lib/swr"

/**
 * Global SWR configuration wrapper.
 *
 * - revalidateOnFocus: refreshes data when the user returns to the tab
 * - dedupingInterval: deduplicates identical requests within 5 seconds
 * - errorRetryCount: retries failed requests up to 2 times
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  )
}
