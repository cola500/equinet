"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { useOnlineStatus } from "./useOnlineStatus"

/**
 * Hook that guards mutations against being executed while offline.
 * Shows a toast message when a mutation is blocked.
 */
export function useOfflineGuard() {
  const isOnline = useOnlineStatus()

  const guardMutation = useCallback(
    <T>(action: () => Promise<T>): Promise<T | undefined> => {
      if (!isOnline) {
        toast.error("Du är offline. Denna åtgärd kräver internetanslutning.")
        return Promise.resolve(undefined)
      }
      return action()
    },
    [isOnline]
  )

  return { isOnline, guardMutation }
}
