"use client"

import { useId } from "react"
import { Button } from "@/components/ui/button"
import { canMarkCompleted, DEFAULT_BOOKING_TIMEZONE } from "@/domain/booking/BookingTime"

interface MarkCompletedButtonProps {
  booking: { bookingDate: string; endTime: string; timezone?: string }
  onClick: () => void
  /** Injected clock for tests; defaults to the device clock */
  now?: Date
}

/**
 * "Markera som genomförd" with BR-BOOK-001 guidance: disabled until the
 * booked end time in the booking's own timezone. Guidance only -- the server
 * decides on receipt and the caller must still show a rejection.
 */
export function MarkCompletedButton({ booking, onClick, now }: MarkCompletedButtonProps) {
  const allowed = canMarkCompleted(
    {
      bookingDate: booking.bookingDate,
      endTime: booking.endTime,
      timezone: booking.timezone ?? DEFAULT_BOOKING_TIMEZONE,
    },
    now ?? new Date()
  )
  const hintId = useId()

  return (
    <div className="flex flex-1 flex-col gap-1">
      <Button
        type="button"
        onClick={onClick}
        disabled={!allowed}
        aria-describedby={allowed ? undefined : hintId}
        className="w-full"
      >
        Markera som genomförd
      </Button>
      {!allowed && (
        <p id={hintId} className="text-xs text-gray-600">
          Kan markeras som genomförd efter kl. {booking.endTime}
        </p>
      )}
    </div>
  )
}
