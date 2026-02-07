"use client"

import { useState } from "react"
import { Clock, ChevronDown, ChevronUp } from "lucide-react"
import { format, parseISO } from "date-fns"
import { sv } from "date-fns/locale"
import { CalendarBooking } from "@/types"

interface PendingBookingsBannerProps {
  pendingBookings: CalendarBooking[]
  onBookingClick: (booking: CalendarBooking) => void
}

export function PendingBookingsBanner({
  pendingBookings,
  onBookingClick,
}: PendingBookingsBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (pendingBookings.length === 0) return null

  const sorted = [...pendingBookings].sort(
    (a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime)
  )

  const count = pendingBookings.length
  const label = count === 1 ? "1 bokning väntar" : `${count} bokningar väntar`

  return (
    <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-label={label}
      >
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-600" />
          <span className="inline-flex items-center justify-center rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white">
            {count}
          </span>
          <span className="text-sm font-medium text-yellow-800">{label}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-yellow-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-yellow-600" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-yellow-200 px-4 py-2">
          <ul className="divide-y divide-yellow-100">
            {sorted.map((booking) => (
              <li key={booking.id}>
                <button
                  onClick={() => onBookingClick(booking)}
                  className="flex w-full items-center gap-4 py-2 text-left text-sm hover:bg-yellow-100 rounded px-2 -mx-2 transition-colors"
                >
                  <span className="font-medium text-gray-900">
                    {booking.service.name}
                  </span>
                  <span className="text-gray-600">
                    {booking.customer.firstName} {booking.customer.lastName}
                  </span>
                  {booking.horseName && (
                    <span className="text-gray-500">{booking.horseName}</span>
                  )}
                  <span className="ml-auto text-gray-500 whitespace-nowrap">
                    {format(parseISO(booking.bookingDate), "d MMM", { locale: sv })}{" "}
                    {booking.startTime}&#8211;{booking.endTime}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
