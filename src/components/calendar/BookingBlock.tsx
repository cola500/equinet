"use client"

import { Clock, CheckCircle2, Check, XCircle, CreditCard, AlertTriangle, Repeat } from "lucide-react"
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
  if (isPaid) {
    return "bg-emerald-100 border-emerald-600 text-emerald-900"
  }

  const styles: Record<string, string> = {
    pending: "bg-yellow-50 border-yellow-500 text-yellow-900",
    confirmed: "bg-green-50 border-green-600 text-green-900",
    completed: "bg-blue-50 border-blue-600 text-blue-900",
    cancelled: "bg-red-50 border-red-500 text-red-900",
    no_show: "bg-orange-50 border-orange-500 text-orange-900",
  }

  return styles[status] || "bg-gray-100 border-gray-500 text-gray-900"
}

function getStatusIcon(status: string, isPaid: boolean) {
  if (isPaid) return <CreditCard className="h-3 w-3 mr-0.5 flex-shrink-0" />

  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-3 w-3 mr-0.5 flex-shrink-0" />,
    confirmed: <CheckCircle2 className="h-3 w-3 mr-0.5 flex-shrink-0" />,
    completed: <Check className="h-3 w-3 mr-0.5 flex-shrink-0" />,
    cancelled: <XCircle className="h-3 w-3 mr-0.5 flex-shrink-0" />,
    no_show: <AlertTriangle className="h-3 w-3 mr-0.5 flex-shrink-0" />,
  }

  return icons[status] || null
}

export function BookingBlock({ booking, onClick }: BookingBlockProps) {
  const topPercent = getTimePosition(booking.startTime)
  const bottomPercent = getTimePosition(booking.endTime)
  const heightPercent = bottomPercent - topPercent
  const isPaid = booking.payment?.status === "succeeded"

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`absolute left-1 right-1 rounded border-l-4 px-2 py-1 text-left text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${getStatusStyles(
        booking.status,
        isPaid
      )}`}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        minHeight: "28px",
      }}
      title={`${booking.service.name} - ${booking.customer.firstName} ${booking.customer.lastName}`}
    >
      <div className="font-semibold truncate flex items-center">
        {getStatusIcon(booking.status, isPaid)}
        {booking.bookingSeriesId && (
          <span title="Återkommande bokning"><Repeat className="h-3 w-3 mr-0.5 flex-shrink-0" /></span>
        )}
        {booking.isManualBooking && (
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
