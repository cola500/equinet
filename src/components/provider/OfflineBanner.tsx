"use client"

import { useEffect, useRef, useState } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const isOfflineEnabled = useFeatureFlag("offline_mode")
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
        className="bg-amber-50 border-b border-amber-200 px-4 py-2"
      >
        <div className="container mx-auto flex items-center gap-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Du är offline</span>
          <span className="text-amber-600">
            Visar cachad data. Vissa funktioner kan vara begränsade.
          </span>
        </div>
      </div>
    )
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="bg-green-50 border-b border-green-200 px-4 py-2"
      >
        <div className="container mx-auto flex items-center gap-2 text-sm text-green-800">
          <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Återansluten</span>
        </div>
      </div>
    )
  }

  return null
}
