"use client"

import { usePendingMutation } from "@/hooks/usePendingMutation"

interface PendingSyncBadgeProps {
  entityId: string
}

/**
 * Small amber badge that shows when an entity has pending offline mutations.
 * Disappears automatically when the mutation is synced.
 */
export function PendingSyncBadge({ entityId }: PendingSyncBadgeProps) {
  const { hasPending } = usePendingMutation(entityId)

  if (!hasPending) return null

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 whitespace-nowrap">
      Väntar på synk
    </span>
  )
}
