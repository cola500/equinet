"use client"

import { CalendarBooking } from "@/types"

interface BookingBlockProps {
  booking: CalendarBooking
  onClick: () => void
}

// Beräkna positionen baserat på tid (08:00 = 0%, 18:00 = 100%)
function getTimePosition(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  const totalMinutes = hours * 60 + minutes
  const startMinutes = 8 * 60 // 08:00
  const endMinutes = 18 * 60 // 18:00
  const range = endMinutes - startMinutes

  return ((totalMinutes - startMinutes) / range) * 100
}

function getStatusStyles(status: string, isPaid: boolean): string {
  // Om betald, visa alltid mörkgrön
  if (isPaid) {
    return "bg-emerald-500 border-emerald-600 text-white"
  }

  const styles: Record<string, string> = {
    pending: "bg-yellow-400 border-yellow-500 text-yellow-900",
    confirmed: "bg-green-400 border-green-500 text-green-900",
    completed: "bg-blue-400 border-blue-500 text-blue-900",
    cancelled: "bg-red-400 border-red-500 text-red-900",
  }

  return styles[status] || "bg-gray-400 border-gray-500 text-gray-900"
}

export function BookingBlock({ booking, onClick }: BookingBlockProps) {
  const topPercent = getTimePosition(booking.startTime)
  const bottomPercent = getTimePosition(booking.endTime)
  const heightPercent = bottomPercent - topPercent
  const isPaid = booking.payment?.status === "succeeded"

  return (
    <button
      onClick={onClick}
      className={`absolute left-1 right-1 rounded border-l-4 px-2 py-1 text-left text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${getStatusStyles(
        booking.status,
        isPaid
      )}`}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        minHeight: "20px",
      }}
      title={`${booking.service.name} - ${booking.customer.firstName} ${booking.customer.lastName}`}
    >
      <div className="font-semibold truncate">{booking.service.name}</div>
      <div className="truncate">
        {booking.startTime}-{booking.endTime}
      </div>
      {heightPercent > 15 && (
        <div className="truncate opacity-80">
          {booking.customer.firstName} {booking.customer.lastName}
        </div>
      )}
      {heightPercent > 20 && booking.horseName && (
        <div className="truncate opacity-70">{booking.horseName}</div>
      )}
    </button>
  )
}
