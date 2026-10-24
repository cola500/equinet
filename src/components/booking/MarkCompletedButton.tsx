"use client"

import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { getBookingEndInstant, DEFAULT_BOOKING_TIMEZONE } from "@/domain/booking/BookingTime"

interface MarkCompletedButtonProps {
  booking: { bookingDate: string; endTime: string; timezone?: string }
  onClick: () => void
  /** Injected clock for tests; defaults to the device clock */
  now?: Date
}

/** Only schedule a wake-up for end times within a day (setTimeout max is ~24.8 days) */
const MAX_WAKE_UP_MS = 24 * 60 * 60 * 1000

/**
 * "Markera som genomförd" with BR-BOOK-001 guidance: disabled until the
 * booked end time in the booking's own timezone. Guidance only -- the server
 * decides on receipt and the caller must still show a rejection.
 */
export function MarkCompletedButton({ booking, onClick, now }: MarkCompletedButtonProps) {
  const hintId = useId()
  // Bumped when the end time passes so an open view enables the button
  const [, setTick] = useState(0)

  const end = getBookingEndInstant({
    bookingDate: booking.bookingDate,
    endTime: booking.endTime,
    timezone: booking.timezone ?? DEFAULT_BOOKING_TIMEZONE,
  })
  const endMs = end.isSuccess ? end.value.getTime() : null
  const nowMs = (now ?? new Date()).getTime()
  const allowed = endMs !== null && nowMs >= endMs

  useEffect(() => {
    if (now || endMs === null) return
    const remaining = endMs - Date.now()
    if (remaining <= 0 || remaining > MAX_WAKE_UP_MS) return
    const timer = setTimeout(() => setTick((t) => t + 1), remaining)
    return () => clearTimeout(timer)
  }, [endMs, now])

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
