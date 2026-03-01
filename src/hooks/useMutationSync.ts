"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { useOnlineStatus } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { processMutationQueue, type SyncResult } from "@/lib/offline/sync-engine"
import { getPendingCount, getUnsyncedMutations } from "@/lib/offline/mutation-queue"

// Module-level guard -- survives component unmount/remount (e.g. from SWR
// revalidation triggering React Suspense re-mounting).
let syncInProgress = false

/**
 * Hook that manages offline mutation sync.
 *
 * - Triggers processMutationQueue() when transitioning from offline to online
 * - Listens for mutation-queued / mutation-synced events to update pending count
 * - Shows toast notifications on sync results
 * - Gated behind the offline_mode feature flag
 */
export function useMutationSync() {
  const isOnline = useOnlineStatus()
  const isOfflineEnabled = useFeatureFlag("offline_mode")
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const wasOfflineRef = useRef(false)

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  // Run sync, then trigger SWR revalidation (replaces revalidateOnReconnect)
  const triggerSync = useCallback(async () => {
    if (syncInProgress) return
    syncInProgress = true
    setIsSyncing(true)

    try {
      const result = await processMutationQueue()
      setLastSyncResult(result)
      await refreshCount()

      // Toast feedback
      if (result.synced > 0 && result.conflicts === 0 && result.failed === 0 && result.rateLimited === 0) {
        toast.success(`${result.synced} ${result.synced === 1 ? "ändring synkad" : "ändringar synkade"}`)
      } else if (result.conflicts > 0 || result.failed > 0 || result.rateLimited > 0) {
        const parts: string[] = []
        if (result.synced > 0) parts.push(`${result.synced} synkade`)
        if (result.conflicts > 0) parts.push(`${result.conflicts} kunde inte synkas`)
        if (result.failed > 0) parts.push(`${result.failed} misslyckades`)
        if (result.rateLimited > 0) parts.push(`${result.rateLimited} begränsade av hastighet`)
        toast.warning(parts.join(", "), { duration: 8000 })
      }

      // Sequence: sync first, THEN revalidate SWR cache.
      // This replaces SWR's implicit revalidateOnReconnect (which we disabled
      // to prevent request bursts and execution context destruction).
      //
      // If some mutations failed/conflicted, skip revalidation for their
      // SWR keys so optimistic data is preserved until the user resolves them.
      const remaining = await getUnsyncedMutations()
      if (remaining.length === 0) {
        await globalMutate(() => true, undefined, { revalidate: true })
      } else {
        const affectedKeys = new Set(remaining.map((m) => mapMutationUrlToSWRKey(m.url)))
        await globalMutate(
          (key) => typeof key === "string" && !affectedKeys.has(key),
          undefined,
          { revalidate: true }
        )
      }
    } finally {
      setIsSyncing(false)
      syncInProgress = false
    }
  }, [refreshCount])

  // Track offline->online transitions
  useEffect(() => {
    if (!isOfflineEnabled) return

    if (!isOnline) {
      wasOfflineRef.current = true
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      triggerSync()
    }
  }, [isOnline, isOfflineEnabled, triggerSync])

  // Listen for queue changes
  useEffect(() => {
    if (!isOfflineEnabled) return

    refreshCount()

    const handleQueueChange = () => refreshCount()
    window.addEventListener("mutation-queued", handleQueueChange)
    window.addEventListener("mutation-synced", handleQueueChange)

    return () => {
      window.removeEventListener("mutation-queued", handleQueueChange)
      window.removeEventListener("mutation-synced", handleQueueChange)
    }
  }, [isOfflineEnabled, refreshCount])

  return { pendingCount, isSyncing, lastSyncResult, triggerSync }
}

/** Reset the module-level sync guard. Test-only. */
export function _resetSyncGuard() {
  syncInProgress = false
}

/** Map a mutation URL to the SWR cache key it affects.
 * Based on CACHEABLE_ENDPOINTS in offline-fetcher.ts. */
function mapMutationUrlToSWRKey(url: string): string {
  // Bookings: /api/bookings/manual, /api/bookings/{id}, /api/bookings/{id}/notes
  if (url.startsWith("/api/bookings")) return "/api/bookings"

  // Route stops: /api/routes/{id}/stops/{id}
  if (/^\/api\/routes\/[^/]+\/stops\//.test(url)) return "/api/routes/my-routes"

  // Availability exceptions: /api/providers/{id}/availability-exceptions/{date}
  const exceptionsMatch = url.match(/^(\/api\/providers\/[^/]+\/availability-exceptions)/)
  if (exceptionsMatch) return exceptionsMatch[1]

  // Availability schedule: /api/providers/{id}/availability-schedule
  const scheduleMatch = url.match(/^(\/api\/providers\/[^/]+\/availability-schedule)/)
  if (scheduleMatch) return scheduleMatch[1]

  // Direct matches: /api/services, /api/provider/customers
  if (url === "/api/services" || url.startsWith("/api/services?")) return "/api/services"
  if (url === "/api/provider/customers" || url.startsWith("/api/provider/customers?")) return "/api/provider/customers"

  // Conservative fallback: use the URL itself
  return url
}
