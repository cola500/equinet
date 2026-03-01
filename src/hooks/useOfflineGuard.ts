"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useOnlineStatus } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import {
  queueMutation,
  getPendingMutationsByEntity,
} from "@/lib/offline/mutation-queue"
import type { PendingMutation } from "@/lib/offline/db"

export interface OfflineMutationOptions {
  method: "PUT" | "PATCH" | "POST" | "DELETE"
  url: string
  body: string
  entityType: PendingMutation["entityType"]
  entityId: string
  optimisticUpdate?: () => void
}

/**
 * Hook that guards mutations against being executed while offline.
 *
 * Without offlineOptions: blocks with error toast (original behavior).
 * With offlineOptions + offline_mode flag: queues to IndexedDB for later sync.
 */
export function useOfflineGuard() {
  const isOnline = useOnlineStatus()
  const isOfflineEnabled = useFeatureFlag("offline_mode")

  const guardMutation = useCallback(
    async <T>(
      action: () => Promise<T>,
      offlineOptions?: OfflineMutationOptions
    ): Promise<T | undefined> => {
      // Online: always execute normally
      if (isOnline) {
        return action()
      }

      // Offline + queueable mutation + feature enabled
      if (offlineOptions && isOfflineEnabled) {
        // Deduplication: check if identical mutation already pending
        const existing = await getPendingMutationsByEntity(
          offlineOptions.entityId
        )
        const isDuplicate = existing.some(
          (m) =>
            m.method === offlineOptions.method &&
            m.url === offlineOptions.url &&
            m.body === offlineOptions.body
        )

        if (isDuplicate) {
          toast.info("Ändringen är redan sparad offline")
          return undefined
        }

        await queueMutation({
          method: offlineOptions.method,
          url: offlineOptions.url,
          body: offlineOptions.body,
          entityType: offlineOptions.entityType,
          entityId: offlineOptions.entityId,
        })

        // Dispatch event so useMutationSync updates its count
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mutation-queued"))
        }

        offlineOptions.optimisticUpdate?.()
        toast.info("Ändringen sparas offline och synkas när du är online igen")
        return undefined
      }

      // Offline + no queue support: block
      toast.error("Du är offline. Denna åtgärd kräver internetanslutning.")
      return undefined
    },
    [isOnline, isOfflineEnabled]
  )

  return { isOnline, guardMutation }
}
