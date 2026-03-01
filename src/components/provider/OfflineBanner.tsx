"use client"

import { useEffect, useRef, useState } from "react"
import { WifiOff, Wifi, Loader2, AlertTriangle } from "lucide-react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useMutationSync } from "@/hooks/useMutationSync"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const isOfflineEnabled = useFeatureFlag("offline_mode")
  const { pendingCount, isSyncing, lastSyncResult } = useMutationSync()
  const [showReconnected, setShowReconnected] = useState(false)
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true
      setShowReconnected(false)
    } else if (wasOffline.current) {
      wasOffline.current = false
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  if (!isOfflineEnabled) return null

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-50 border-b border-amber-200 px-4 py-2"
      >
        <div className="container mx-auto flex items-center gap-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Du är offline</span>
          {pendingCount > 0 ? (
            <span className="text-amber-600">
              {pendingCount} {pendingCount === 1 ? "ändring väntar" : "ändringar väntar"} på synk
            </span>
          ) : (
            <span className="text-amber-600">
              Visar cachad data. Vissa funktioner kan vara begränsade.
            </span>
          )}
        </div>
      </div>
    )
  }

  if (showReconnected) {
    // Syncing in progress
    if (isSyncing) {
      return (
        <div
          role="status"
          aria-live="polite"
          className="bg-blue-50 border-b border-blue-200 px-4 py-2"
        >
          <div className="container mx-auto flex items-center gap-2 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            <span className="font-medium">Återansluten</span>
            <span className="text-blue-600">Synkar ändringar...</span>
          </div>
        </div>
      )
    }

    // Sync completed with results
    if (lastSyncResult && lastSyncResult.synced > 0) {
      return (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-50 border-b border-green-200 px-4 py-2"
        >
          <div className="container mx-auto flex items-center gap-2 text-sm text-green-800">
            <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">Återansluten</span>
            <span className="text-green-600">
              {lastSyncResult.synced} {lastSyncResult.synced === 1 ? "ändring synkad" : "ändringar synkade"}
            </span>
          </div>
        </div>
      )
    }

    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-green-50 border-b border-green-200 px-4 py-2"
      >
        <div className="container mx-auto flex items-center gap-2 text-sm text-green-800">
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Återansluten</span>
        </div>
      </div>
    )
  }

  // Persistent error banner for failed/conflicted syncs (shown after reconnected phase)
  if (lastSyncResult && (lastSyncResult.conflicts > 0 || lastSyncResult.failed > 0)) {
    const total = lastSyncResult.conflicts + lastSyncResult.failed
    return (
      <div role="alert" className="bg-red-50 border-b border-red-200 px-4 py-2">
        <div className="container mx-auto flex items-center gap-2 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">
            {total} {total === 1 ? "ändring kunde inte synkas" : "ändringar kunde inte synkas"}
          </span>
        </div>
      </div>
    )
  }

  return null
}
