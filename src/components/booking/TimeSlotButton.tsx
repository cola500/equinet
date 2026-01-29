"use client"

import { cn } from "@/lib/utils"

type UnavailableReason = "booked" | "travel-time" | "past"

interface TimeSlotButtonProps {
  startTime: string
  endTime: string
  isAvailable: boolean
  isSelected: boolean
  unavailableReason?: UnavailableReason
  onClick: () => void
}

const reasonLabels: Record<UnavailableReason, string> = {
  booked: "Bokad",
  "travel-time": "Restid",
  past: "Passerad",
}

const reasonStyles: Record<UnavailableReason, string> = {
  booked: "bg-red-50 text-red-400 border border-red-200",
  "travel-time": "bg-orange-50 text-orange-400 border border-orange-200",
  past: "bg-gray-100 text-gray-300",
}

/**
 * A clickable button representing a time slot
 *
 * Visual states:
 * - Available: Green background, clickable
 * - Booked: Red tint, shows "Bokad"
 * - Travel-time: Orange tint, shows "Restid"
 * - Past: Gray, shows "Passerad"
 * - Selected: Green with ring highlight
 */
export function TimeSlotButton({
  startTime,
  isAvailable,
  isSelected,
  unavailableReason,
  onClick,
}: TimeSlotButtonProps) {
  const unavailableStyle = !isAvailable && unavailableReason
    ? reasonStyles[unavailableReason]
    : "bg-gray-100 text-gray-400"

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onClick}
      title={!isAvailable && unavailableReason ? reasonLabels[unavailableReason] : undefined}
      className={cn(
        "w-full px-2 py-1.5 text-sm rounded-md transition-all",
        "min-h-[44px] min-w-[44px]", // Touch target
        isAvailable
          ? "bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer"
          : `${unavailableStyle} cursor-not-allowed`,
        isSelected && "ring-2 ring-green-600 bg-green-200"
      )}
    >
      <span>{startTime}</span>
      {!isAvailable && unavailableReason && unavailableReason !== "past" && (
        <span className="block text-[10px] leading-tight mt-0.5">
          {reasonLabels[unavailableReason]}
        </span>
      )}
    </button>
  )
}
