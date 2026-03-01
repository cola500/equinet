"use client"

import { usePendingMutation } from "@/hooks/usePendingMutation"

interface PendingSyncBadgeProps {
  entityId: string
}

/**
 * Small badge that shows when an entity has pending offline mutations.
 * Color indicates status: amber (pending), red (conflict/failed).
 * Disappears automatically when the mutation is synced.
 */
export function PendingSyncBadge({ entityId }: PendingSyncBadgeProps) {
  const { hasPending, hasConflict, hasFailed } = usePendingMutation(entityId)

  if (!hasPending) return null

  if (hasConflict) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 whitespace-nowrap">
        Synkkonflikt
      </span>
    )
  }

  if (hasFailed) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 whitespace-nowrap">
        Synk misslyckades
      </span>
    )
  }

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 whitespace-nowrap">
      Väntar på synk
    </span>
  )
}
