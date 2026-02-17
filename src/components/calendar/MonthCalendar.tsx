"use client"

import { useMemo, useState, useRef, useEffect } from "react"
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
  onTimeSlotClick?: (date: string, time: string) => void
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
    no_show: "bg-orange-400",
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
  onTimeSlotClick,
}: MonthCalendarProps) {
  // Kontextuell popup vid klick på dag
  const popupRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [dayPopup, setDayPopup] = useState<{
    date: string
    label: string
    topPx: number
    leftPx: number
  } | null>(null)

  // Stäng popup vid navigation
  useEffect(() => {
    setDayPopup(null)
  }, [currentDate])

  // Stäng popup vid klick utanför (ref-check, samma mönster som WeekCalendar)
  useEffect(() => {
    if (!dayPopup) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return
      setDayPopup(null)
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dayPopup])
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
      <div ref={gridRef} className="relative grid grid-cols-7">
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
            <div
              key={dateKey}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                if (onTimeSlotClick) {
                  const label = format(day, "d MMMM", { locale: sv })
                  const gridRect = gridRef.current!.getBoundingClientRect()
                  const topPx = e.clientY - gridRect.top
                  const leftPx = e.clientX - gridRect.left
                  setDayPopup({ date: dateKey, label, topPx, leftPx })
                } else {
                  onDateClick?.(dateKey)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  if (onTimeSlotClick) {
                    const label = format(day, "d MMMM", { locale: sv })
                    // Fallback: centrera popup på cellen
                    const cellRect = e.currentTarget.getBoundingClientRect()
                    const gridRect = gridRef.current!.getBoundingClientRect()
                    const topPx = cellRect.top - gridRect.top + cellRect.height / 2
                    const leftPx = cellRect.left - gridRect.left + cellRect.width / 2
                    setDayPopup({ date: dateKey, label, topPx, leftPx })
                  } else {
                    onDateClick?.(dateKey)
                  }
                }
              }}
              className={`relative min-h-[80px] md:min-h-[100px] p-1 md:p-2 border-b border-r text-left hover:bg-gray-100 transition-colors cursor-pointer ${bgClass}`}
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

            </div>
          )
        })}

        {/* Kontextuell popup -- renderas utanför cellerna */}
        {dayPopup && (
          <div
            ref={popupRef}
            className="absolute z-30 -translate-x-1/2"
            style={{ top: `${dayPopup.topPx}px`, left: `${dayPopup.leftPx}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white border border-green-300 rounded-lg shadow-lg px-4 py-3 text-sm w-48">
              <p className="text-gray-700 mb-2 font-medium">
                {dayPopup.label}
              </p>
              <button
                className="w-full bg-green-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-green-700 transition-colors"
                onClick={() => {
                  onTimeSlotClick!(dayPopup.date, "")
                  setDayPopup(null)
                }}
              >
                Skapa bokning
              </button>
              <button
                className="w-full mt-1 text-gray-600 hover:text-gray-800 text-xs py-1"
                onClick={() => {
                  onDateClick?.(dayPopup.date)
                  setDayPopup(null)
                }}
              >
                Ändra tillgänglighet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
