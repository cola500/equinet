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
import { CalendarBooking, AvailabilityDay } from "@/types"

interface WeekCalendarProps {
  currentDate: Date
  bookings: CalendarBooking[]
  availability?: AvailabilityDay[]
  onBookingClick: (booking: CalendarBooking) => void
  onDayClick?: (dayOfWeek: number) => void
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
  onBookingClick,
  onDayClick,
}: WeekCalendarProps) {
  // Skapa veckans dagar (Mån-Sön)
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [currentDate])

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

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header med veckodagar */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
        <div className="p-2 border-r bg-gray-50" /> {/* Tom cell för tidkolumnen */}
        {weekDays.map((day) => {
          const dayOfWeek = jsDayToOurDay(getDay(day))
          const dayAvailability = availability[dayOfWeek]
          const isClosed = dayAvailability?.isClosed

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick?.(dayOfWeek)}
              className={`p-2 text-center border-r last:border-r-0 hover:bg-gray-100 transition-colors cursor-pointer ${
                isToday(day) ? "bg-green-50" : "bg-gray-50"
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
              {dayAvailability && (
                <div className={`text-xs ${isClosed ? "text-gray-400" : "text-gray-500"}`}>
                  {isClosed
                    ? "Stängt"
                    : `${dayAvailability.startTime}-${dayAvailability.endTime}`}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Kalenderrutnät */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {/* Tidskolumn */}
        <div className="border-r">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="h-12 border-b last:border-b-0 text-xs text-gray-500 text-right pr-2 pt-0.5"
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Dagkolumner */}
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const dayBookings = bookingsByDay[dateKey] || []
          const dayOfWeek = jsDayToOurDay(getDay(day))
          const dayAvailability = availability[dayOfWeek]
          const isClosed = dayAvailability?.isClosed

          // Beräkna öppettids-positioner
          const openStart = dayAvailability && !isClosed
            ? getTimePosition(dayAvailability.startTime)
            : 0
          const openEnd = dayAvailability && !isClosed
            ? getTimePosition(dayAvailability.endTime)
            : 0

          return (
            <div
              key={day.toISOString()}
              className={`relative border-r last:border-r-0 ${
                isClosed ? "bg-gray-100" : ""
              }`}
            >
              {/* Timlinjer */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-12 border-b last:border-b-0 border-gray-100"
                />
              ))}

              {/* Öppettids-bakgrund (grön för öppet) */}
              {dayAvailability && !isClosed && (
                <div
                  className="absolute left-0 right-0 bg-green-100/50 pointer-events-none"
                  style={{
                    top: `${openStart}%`,
                    height: `${openEnd - openStart}%`,
                  }}
                />
              )}

              {/* Stängt-markering (skrafferad) */}
              {isClosed && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <span className="text-gray-400 text-sm font-medium rotate-[-45deg]">
                    STÄNGT
                  </span>
                </div>
              )}

              {/* Markering för tid utanför öppettider (före öppning) */}
              {dayAvailability && !isClosed && openStart > 0 && (
                <div
                  className="absolute left-0 right-0 bg-gray-50 pointer-events-none"
                  style={{
                    top: 0,
                    height: `${openStart}%`,
                  }}
                />
              )}

              {/* Markering för tid utanför öppettider (efter stängning) */}
              {dayAvailability && !isClosed && openEnd < 100 && (
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
