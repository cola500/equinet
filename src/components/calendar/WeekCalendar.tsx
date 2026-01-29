"use client"

import { useMemo } from "react"
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  getDay,
} from "date-fns"
import { sv } from "date-fns/locale"
import { BookingBlock } from "./BookingBlock"
import { CalendarBooking, AvailabilityDay, AvailabilityException } from "@/types"
import { ViewMode } from "./CalendarHeader"

interface WeekCalendarProps {
  currentDate: Date
  bookings: CalendarBooking[]
  availability?: AvailabilityDay[]
  exceptions?: AvailabilityException[]
  viewMode?: ViewMode
  onBookingClick: (booking: CalendarBooking) => void
  onDayClick?: (dayOfWeek: number) => void
  onDateClick?: (date: string) => void // YYYY-MM-DD format
}

// Tidsaxel: 08:00 - 18:00
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i) // 8, 9, 10, ... 18
const START_HOUR = 8
const END_HOUR = 18

// Konvertera JS getDay() (0=Söndag) till vårt dayOfWeek (0=Måndag)
function jsDayToOurDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

// Beräkna position i procent baserat på tid
function getTimePosition(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  const totalMinutes = hours * 60 + minutes
  const startMinutes = START_HOUR * 60
  const endMinutes = END_HOUR * 60
  const range = endMinutes - startMinutes

  return Math.max(0, Math.min(100, ((totalMinutes - startMinutes) / range) * 100))
}

export function WeekCalendar({
  currentDate,
  bookings,
  availability = [],
  exceptions = [],
  viewMode = "week",
  onBookingClick,
  onDayClick,
  onDateClick,
}: WeekCalendarProps) {
  // Skapa veckans dagar (Mån-Sön) eller bara aktuell dag
  const displayDays = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate]
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [currentDate, viewMode])

  // Antal kolumner baserat på vy
  const gridCols = viewMode === "day" ? "grid-cols-[60px_1fr]" : "grid-cols-[60px_repeat(7,1fr)]"

  // Gruppera bokningar per dag
  const bookingsByDay = useMemo(() => {
    const grouped: Record<string, CalendarBooking[]> = {}

    bookings.forEach((booking) => {
      const dateKey = booking.bookingDate.split("T")[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(booking)
    })

    return grouped
  }, [bookings])

  // Indexera exceptions per datum för snabb lookup
  const exceptionsByDate = useMemo(() => {
    const indexed: Record<string, AvailabilityException> = {}
    exceptions.forEach((exception) => {
      indexed[exception.date] = exception
    })
    return indexed
  }, [exceptions])

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header med veckodagar */}
      <div className={`grid ${gridCols} border-b`}>
        <div className="p-2 border-r bg-gray-50" /> {/* Tom cell för tidkolumnen */}
        {displayDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const dayOfWeek = jsDayToOurDay(getDay(day))
          const dayAvailability = availability[dayOfWeek]
          const exception = exceptionsByDate[dateKey]

          // Exception har prioritet över veckoschema
          const isClosed = exception ? exception.isClosed : dayAvailability?.isClosed
          const hasException = !!exception

          // Determine what times to show
          let displayTimes: string | null = null
          if (exception) {
            if (exception.isClosed) {
              displayTimes = exception.reason || "Stängt"
            } else if (exception.startTime && exception.endTime) {
              displayTimes = `${exception.startTime}-${exception.endTime}`
            }
          } else if (dayAvailability) {
            displayTimes = dayAvailability.isClosed
              ? "Stängt"
              : `${dayAvailability.startTime}-${dayAvailability.endTime}`
          }

          // Get location from exception if set
          const displayLocation = exception?.location || null

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (onDateClick) {
                  onDateClick(dateKey)
                } else {
                  onDayClick?.(dayOfWeek)
                }
              }}
              className={`p-2 text-center border-r last:border-r-0 hover:bg-gray-100 transition-colors cursor-pointer ${
                hasException && isClosed
                  ? "bg-orange-50"
                  : isToday(day)
                    ? "bg-green-50"
                    : "bg-gray-50"
              }`}
            >
              <div className="text-sm text-gray-600">
                {format(day, "EEE", { locale: sv })}
              </div>
              <div
                className={`text-lg font-semibold ${
                  isToday(day) ? "text-green-600" : ""
                }`}
              >
                {format(day, "d")}
              </div>
              {displayTimes && (
                <div
                  className={`text-xs ${
                    hasException && isClosed
                      ? "text-orange-600 font-medium"
                      : isClosed
                        ? "text-gray-400"
                        : "text-gray-500"
                  }`}
                >
                  {displayTimes}
                </div>
              )}
              {displayLocation && (
                <div className="text-xs text-purple-600 font-medium truncate">
                  {displayLocation}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Kalenderrutnät */}
      <div className={`grid ${gridCols}`}>
        {/* Tidskolumn */}
        <div className="border-r">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className={`border-b last:border-b-0 text-xs text-gray-500 text-right pr-2 pt-0.5 ${
                viewMode === "day" ? "h-16" : "h-12"
              }`}
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Dagkolumner */}
        {displayDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const dayBookings = bookingsByDay[dateKey] || []
          const dayOfWeek = jsDayToOurDay(getDay(day))
          const dayAvailability = availability[dayOfWeek]
          const exception = exceptionsByDate[dateKey]

          // Exception har prioritet över veckoschema
          const hasException = !!exception
          const isClosed = exception
            ? exception.isClosed
            : dayAvailability?.isClosed

          // Beräkna öppettider med exception-prioritet
          let openStart = 0
          let openEnd = 0
          if (!isClosed) {
            if (exception && exception.startTime && exception.endTime) {
              openStart = getTimePosition(exception.startTime)
              openEnd = getTimePosition(exception.endTime)
            } else if (dayAvailability) {
              openStart = getTimePosition(dayAvailability.startTime)
              openEnd = getTimePosition(dayAvailability.endTime)
            }
          }

          return (
            <div
              key={day.toISOString()}
              className={`relative border-r last:border-r-0 ${
                isClosed
                  ? hasException
                    ? "bg-orange-100"
                    : "bg-gray-100"
                  : ""
              }`}
            >
              {/* Timlinjer */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className={`border-b last:border-b-0 border-gray-100 ${
                    viewMode === "day" ? "h-16" : "h-12"
                  }`}
                />
              ))}

              {/* Öppettids-bakgrund (grön för öppet) */}
              {!isClosed && openEnd > openStart && (
                <div
                  className="absolute left-0 right-0 bg-green-100/50 pointer-events-none"
                  style={{
                    top: `${openStart}%`,
                    height: `${openEnd - openStart}%`,
                  }}
                />
              )}

              {/* Stängt-markering */}
              {isClosed && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <span
                    className={`text-sm font-medium rotate-[-45deg] ${
                      hasException ? "text-orange-500" : "text-gray-400"
                    }`}
                  >
                    {hasException && exception?.reason
                      ? exception.reason.toUpperCase()
                      : "STÄNGT"}
                  </span>
                </div>
              )}

              {/* Markering för tid utanför öppettider (före öppning) */}
              {!isClosed && openStart > 0 && (
                <div
                  className="absolute left-0 right-0 bg-gray-50 pointer-events-none"
                  style={{
                    top: 0,
                    height: `${openStart}%`,
                  }}
                />
              )}

              {/* Markering för tid utanför öppettider (efter stängning) */}
              {!isClosed && openEnd < 100 && (
                <div
                  className="absolute left-0 right-0 bg-gray-50 pointer-events-none"
                  style={{
                    top: `${openEnd}%`,
                    height: `${100 - openEnd}%`,
                  }}
                />
              )}

              {/* Idag-markering */}
              {isToday(day) && !isClosed && (
                <div className="absolute inset-0 ring-2 ring-green-400 ring-inset pointer-events-none" />
              )}

              {/* Bokningar */}
              <div className="absolute inset-0">
                {dayBookings.map((booking) => (
                  <BookingBlock
                    key={booking.id}
                    booking={booking}
                    onClick={() => onBookingClick(booking)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
