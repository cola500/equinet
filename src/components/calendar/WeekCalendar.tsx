"use client"

import { useMemo } from "react"
import {
  format,
  startOfWeek,
  addDays,
  isToday,
} from "date-fns"
import { sv } from "date-fns/locale"
import { BookingBlock } from "./BookingBlock"
import { CalendarBooking } from "@/types"

interface WeekCalendarProps {
  currentDate: Date
  bookings: CalendarBooking[]
  onBookingClick: (booking: CalendarBooking) => void
}

// Tidsaxel: 08:00 - 18:00
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i) // 8, 9, 10, ... 18

export function WeekCalendar({
  currentDate,
  bookings,
  onBookingClick,
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
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-2 text-center border-r last:border-r-0 ${
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
          </div>
        ))}
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

          return (
            <div
              key={day.toISOString()}
              className={`relative border-r last:border-r-0 ${
                isToday(day) ? "bg-green-50/30" : ""
              }`}
            >
              {/* Timlinjer */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-12 border-b last:border-b-0 border-gray-100"
                />
              ))}

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
