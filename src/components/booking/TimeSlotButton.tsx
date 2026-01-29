"use client"

import { cn } from "@/lib/utils"

interface TimeSlotButtonProps {
  startTime: string
  endTime: string
  isAvailable: boolean
  isSelected: boolean
  onClick: () => void
}

/**
 * A clickable button representing a time slot
 *
 * Visual states:
 * - Available: Green background, clickable
 * - Unavailable: Gray background, disabled
 * - Selected: Green with ring highlight
 */
export function TimeSlotButton({
  startTime,
  isAvailable,
  isSelected,
  onClick,
}: TimeSlotButtonProps) {
  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onClick}
      className={cn(
        "w-full px-2 py-1.5 text-sm rounded-md transition-all",
        "min-h-[44px] min-w-[44px]", // Touch target
        isAvailable
          ? "bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer"
          : "bg-gray-100 text-gray-400 cursor-not-allowed",
        isSelected && "ring-2 ring-green-600 bg-green-200"
      )}
    >
      {startTime}
    </button>
  )
}
