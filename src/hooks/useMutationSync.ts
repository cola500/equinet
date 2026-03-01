"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { useOnlineStatus } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { processMutationQueue, type SyncResult } from "@/lib/offline/sync-engine"
import { getPendingCount } from "@/lib/offline/mutation-queue"

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
      await globalMutate(() => true, undefined, { revalidate: true })
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
