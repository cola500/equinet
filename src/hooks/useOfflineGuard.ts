"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useOnlineStatus, reportConnectivityLoss } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import {
  queueMutation,
  getPendingMutationsByEntity,
} from "@/lib/offline/mutation-queue"
import type { PendingMutation } from "@/lib/offline/db"

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof DOMException && error.name === "AbortError") return true
  return false
}

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
 *
 * Order: optimisticUpdate -> toast -> dedup (non-POST) -> queueMutation
 * This gives immediate UI feedback before the async IndexedDB operations.
 */
export function useOfflineGuard() {
  const isOnline = useOnlineStatus()
  const isOfflineEnabled = useFeatureFlag("offline_mode")

  const guardMutation = useCallback(
    async <T>(
      action: () => Promise<T>,
      offlineOptions?: OfflineMutationOptions
    ): Promise<T | undefined> => {
      // Online: try to execute normally
      if (isOnline) {
        try {
          return await action()
        } catch (error) {
          // Network error while "online" -- browser lied about connectivity.
          // Fall through to offline queueing if supported.
          if (offlineOptions && isOfflineEnabled && isNetworkError(error)) {
            reportConnectivityLoss()
            // Fall through to offline queue below
          } else {
            throw error
          }
        }
      }

      // Offline (or fell through from network error) + queueable mutation + feature enabled
      if (offlineOptions && isOfflineEnabled) {
        // 1. Immediate feedback (before any async IndexedDB work)
        offlineOptions.optimisticUpdate?.()
        toast.success("Sparad lokalt -- synkas automatiskt")

        // 2. Dedup check (only for non-POST -- POST always has unique entityId)
        if (offlineOptions.method !== "POST") {
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
        }

        // 3. Queue to IndexedDB
        try {
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
        } catch {
          toast.error("Kunde inte spara offline. Försök igen.")
        }

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
