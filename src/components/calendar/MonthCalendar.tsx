"use client"

import { useMemo } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  getDay,
} from "date-fns"
import { sv } from "date-fns/locale"
import { CalendarBooking, AvailabilityDay, AvailabilityException } from "@/types"

interface MonthCalendarProps {
  currentDate: Date
  bookings: CalendarBooking[]
  availability?: AvailabilityDay[]
  exceptions?: AvailabilityException[]
  onBookingClick: (booking: CalendarBooking) => void
  onDateClick?: (date: string) => void
}

const WEEKDAY_LABELS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]
const MAX_VISIBLE_BOOKINGS = 3

// Konvertera JS getDay() (0=Söndag) till vårt dayOfWeek (0=Måndag)
function jsDayToOurDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

function getBookingDotColor(status: string, isPaid: boolean): string {
  if (isPaid) return "bg-emerald-500"
  const colors: Record<string, string> = {
    pending: "bg-yellow-400",
    confirmed: "bg-green-400",
    completed: "bg-blue-400",
    cancelled: "bg-red-400",
  }
  return colors[status] || "bg-gray-400"
}

export function MonthCalendar({
  currentDate,
  bookings,
  availability = [],
  exceptions = [],
  onBookingClick,
  onDateClick,
}: MonthCalendarProps) {
  // Build array of all days to display (6 weeks grid)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let day = gridStart
    while (day <= gridEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentDate])

  // Index bookings by date
  const bookingsByDay = useMemo(() => {
    const grouped: Record<string, CalendarBooking[]> = {}
    bookings.forEach((booking) => {
      const dateKey = booking.bookingDate.split("T")[0]
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(booking)
    })
    return grouped
  }, [bookings])

  // Index exceptions by date
  const exceptionsByDate = useMemo(() => {
    const indexed: Record<string, AvailabilityException> = {}
    exceptions.forEach((e) => { indexed[e.date] = e })
    return indexed
  }, [exceptions])

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="p-2 text-center text-sm font-medium text-gray-600 bg-gray-50"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const dayBookings = bookingsByDay[dateKey] || []
          const dayOfWeek = jsDayToOurDay(getDay(day))
          const dayAvailability = availability[dayOfWeek]
          const exception = exceptionsByDate[dateKey]

          const isClosed = exception
            ? exception.isClosed
            : dayAvailability?.isClosed
          const hasException = !!exception && exception.isClosed

          // Background based on status
          let bgClass = ""
          if (!inMonth) {
            bgClass = "bg-gray-50"
          } else if (hasException) {
            bgClass = "bg-orange-50"
          } else if (isClosed) {
            bgClass = "bg-gray-50"
          }

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDateClick?.(dateKey)}
              className={`min-h-[80px] md:min-h-[100px] p-1 md:p-2 border-b border-r text-left hover:bg-gray-100 transition-colors cursor-pointer ${bgClass}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium inline-flex items-center justify-center ${
                    today
                      ? "bg-green-600 text-white rounded-full w-7 h-7"
                      : inMonth
                        ? "text-gray-900"
                        : "text-gray-400"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {hasException && (
                  <span className="text-xs text-orange-600 hidden md:inline">
                    {exception?.reason || "Stängt"}
                  </span>
                )}
              </div>

              {/* Booking indicators */}
              {dayBookings.length > 0 && (
                <div className="space-y-0.5">
                  {dayBookings.slice(0, MAX_VISIBLE_BOOKINGS).map((booking) => {
                    const isPaid = booking.payment?.status === "succeeded"
                    return (
                      <div
                        key={booking.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onBookingClick(booking)
                        }}
                        className={`text-xs truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-80 ${getBookingDotColor(booking.status, isPaid)} ${
                          isPaid ? "text-white" : ""
                        }`}
                      >
                        <span className="hidden md:inline">
                          {booking.startTime} {booking.service?.name || "Bokning"}
                        </span>
                        <span className="md:hidden">
                          {booking.startTime}
                        </span>
                      </div>
                    )
                  })}
                  {dayBookings.length > MAX_VISIBLE_BOOKINGS && (
                    <div className="text-xs text-gray-500 px-1">
                      +{dayBookings.length - MAX_VISIBLE_BOOKINGS} till
                    </div>
                  )}
                </div>
              )}

              {/* Closed indicator for days with no bookings */}
              {dayBookings.length === 0 && isClosed && inMonth && (
                <div className="text-xs text-gray-400 hidden md:block">
                  {hasException ? "" : "Stängt"}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
