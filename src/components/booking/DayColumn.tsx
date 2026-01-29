"use client"

import { format, parseISO } from "date-fns"
import { sv } from "date-fns/locale"
import { TimeSlot } from "@/lib/utils/slotCalculator"
import { TimeSlotButton } from "./TimeSlotButton"

interface DayColumnProps {
  date: string // YYYY-MM-DD
  slots: TimeSlot[]
  isClosed: boolean
  selectedTime: string | null
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
}

/**
 * A column representing one day with all available time slots
 *
 * Shows:
 * - Day name and date in header
 * - "Stängt" if closed
 * - All time slots (available = green, unavailable = gray)
 */
export function DayColumn({
  date,
  slots,
  isClosed,
  selectedTime,
  onSlotSelect,
}: DayColumnProps) {
  const dateObj = parseISO(date)
  const dayName = format(dateObj, "EEE", { locale: sv })
  const dayNumber = format(dateObj, "d")

  return (
    <div className="flex flex-col min-w-[80px]">
      {/* Date header */}
      <div className="text-center pb-2 border-b mb-2">
        <div className="text-sm font-medium text-gray-600 capitalize">
          {dayName}
        </div>
        <div className="text-lg font-bold">{dayNumber}</div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        {isClosed ? (
          <div className="text-center text-sm text-gray-400 py-4">Stängt</div>
        ) : (
          slots.map((slot) => (
            <TimeSlotButton
              key={slot.startTime}
              startTime={slot.startTime}
              endTime={slot.endTime}
              isAvailable={slot.isAvailable}
              unavailableReason={slot.unavailableReason}
              isSelected={selectedTime === slot.startTime}
              onClick={() => onSlotSelect(date, slot.startTime, slot.endTime)}
            />
          ))
        )}
      </div>
    </div>
  )
}
