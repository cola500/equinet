"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useOnlineStatus } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { processMutationQueue, type SyncResult } from "@/lib/offline/sync-engine"
import { getPendingCount } from "@/lib/offline/mutation-queue"

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
  const syncInProgressRef = useRef(false)

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  // Run sync
  const triggerSync = useCallback(async () => {
    if (syncInProgressRef.current) return
    syncInProgressRef.current = true
    setIsSyncing(true)

    try {
      const result = await processMutationQueue()
      setLastSyncResult(result)
      await refreshCount()

      // Toast feedback
      if (result.synced > 0 && result.conflicts === 0 && result.failed === 0) {
        toast.success(`${result.synced} ${result.synced === 1 ? "ändring synkad" : "ändringar synkade"}`)
      } else if (result.conflicts > 0 || result.failed > 0) {
        const parts: string[] = []
        if (result.synced > 0) parts.push(`${result.synced} synkade`)
        if (result.conflicts > 0) parts.push(`${result.conflicts} kunde inte synkas`)
        if (result.failed > 0) parts.push(`${result.failed} misslyckades`)
        toast.warning(parts.join(", "))
      }
    } finally {
      setIsSyncing(false)
      syncInProgressRef.current = false
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
