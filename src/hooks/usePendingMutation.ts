"use client"

import { useCallback, useEffect, useState } from "react"
import { getActiveMutationsByEntity } from "@/lib/offline/mutation-queue"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

/**
 * Hook that tracks whether a specific entity has pending offline mutations.
 * Updates when mutations are queued or synced.
 */
export function usePendingMutation(entityId: string) {
  const [count, setCount] = useState(0)
  const [hasConflict, setHasConflict] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  const isOfflineEnabled = useFeatureFlag("offline_mode")

  const refresh = useCallback(async () => {
    if (!isOfflineEnabled) return
    const mutations = await getActiveMutationsByEntity(entityId)
    setCount(mutations.length)
    setHasConflict(mutations.some((m) => m.status === "conflict"))
    setHasFailed(mutations.some((m) => m.status === "failed"))
  }, [entityId, isOfflineEnabled])

  useEffect(() => {
    refresh()

    const handler = () => refresh()
    window.addEventListener("mutation-queued", handler)
    window.addEventListener("mutation-synced", handler)

    return () => {
      window.removeEventListener("mutation-queued", handler)
      window.removeEventListener("mutation-synced", handler)
    }
  }, [refresh])

  return { hasPending: count > 0, count, hasConflict, hasFailed }
}
