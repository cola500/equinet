"use client"

import { Repeat } from "lucide-react"
import { CalendarBooking } from "@/types"
import { getBookingStatusStyle } from "@/components/booking/booking-status"

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

export function BookingBlock({ booking, onClick }: BookingBlockProps) {
  const topPercent = getTimePosition(booking.startTime)
  const bottomPercent = getTimePosition(booking.endTime)
  const heightPercent = bottomPercent - topPercent
  const isPaid = booking.payment?.status === "succeeded"
  const isOfflinePending = booking._isOfflinePending
  const status = getBookingStatusStyle(booking.status, isPaid)
  const StatusIcon = status.icon

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`absolute left-1 right-1 min-h-[44px] sm:min-h-[28px] rounded border-l-4 px-2 py-1 text-left text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
        isOfflinePending
          ? "bg-amber-50 border-amber-400 border-dashed text-amber-900"
          : status.block
      }`}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
      }}
      title={`${booking.service.name} - ${booking.customer.firstName} ${booking.customer.lastName}`}
    >
      <div className="font-semibold truncate flex items-center">
        {StatusIcon && <StatusIcon className="h-3 w-3 mr-0.5 flex-shrink-0" />}
        {booking.bookingSeriesId && (
          <span title="Återkommande bokning"><Repeat className="h-3 w-3 mr-0.5 flex-shrink-0" /></span>
        )}
        {isOfflinePending && (
          <span className="inline-block bg-amber-200 text-amber-800 text-[10px] font-bold rounded px-1 mr-1" title="Sparad lokalt">Lokalt</span>
        )}
        {booking.isManualBooking && !isOfflinePending && (
          <span className="inline-block bg-white/30 text-[10px] font-bold rounded px-1 mr-1" title="Manuell bokning">M</span>
        )}
        <span className="truncate">{booking.service.name}</span>
      </div>
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
