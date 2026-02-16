"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  onTimeSlotClick?: (date: string, time: string) => void
}

// Tidsaxel: 08:00 - 18:00
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i) // 8, 9, 10, ... 18
const START_HOUR = 8
const END_HOUR = 18

// Konvertera JS getDay() (0=Söndag) till vårt dayOfWeek (0=Måndag)
function jsDayToOurDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

// Beräkna nu-linjens position i procent (null om utanför synligt intervall)
export function getNowPosition(hours: number, minutes: number): number | null {
  const totalMinutes = hours * 60 + minutes
  if (totalMinutes < START_HOUR * 60 || totalMinutes > END_HOUR * 60) return null
  return ((totalMinutes - START_HOUR * 60) / ((END_HOUR - START_HOUR) * 60)) * 100
}

// Konvertera Y-position i procent till HH:mm snappat till 15-minutersintervall
export function positionToTime(yPercent: number): string {
  const clamped = Math.max(0, Math.min(100, yPercent))
  const totalMinutes = (clamped / 100) * (END_HOUR - START_HOUR) * 60
  const snapped = Math.round(totalMinutes / 15) * 15
  const hours = START_HOUR + Math.floor(snapped / 60)
  const minutes = snapped % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
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
  onTimeSlotClick,
}: WeekCalendarProps) {
  // Skapa dagar baserat på vy-läge
  const displayDays = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate]
    }
    if (viewMode === "3-day") {
      return Array.from({ length: 3 }, (_, i) => addDays(currentDate, i))
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [currentDate, viewMode])

  // Antal kolumner baserat på vy
  const gridCols =
    viewMode === "day"
      ? "grid-cols-[60px_1fr]"
      : viewMode === "3-day"
        ? "grid-cols-[60px_repeat(3,1fr)]"
        : "grid-cols-[60px_repeat(7,1fr)]"

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

  // Nu-linje: uppdatera varje minut
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setNowMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const nowPosition = useMemo(() => {
    const h = Math.floor(nowMinutes / 60)
    const m = nowMinutes % 60
    return getNowPosition(h, m)
  }, [nowMinutes])

  // Kontextuell popup vid klick i dagkolumnen
  const popupRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [slotPopup, setSlotPopup] = useState<{
    date: string
    time: string
    topPx: number
    dateLabel: string
  } | null>(null)

  // Stäng popup vid navigation (vy-byte, datumändring)
  useEffect(() => {
    setSlotPopup(null)
  }, [currentDate, viewMode])

  // Stäng popup vid klick utanför (ref-check istället för stopPropagation)
  useEffect(() => {
    if (!slotPopup) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return
      setSlotPopup(null)
    }
    // setTimeout så att det inte triggas av samma klick som öppnade popupen
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [slotPopup])

  // Onboarding-tips: visas en gång, dismissbar via localStorage
  const CALENDAR_TIP_KEY = "equinet_calendar_click_tip_dismissed"
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    if (onTimeSlotClick && typeof window !== "undefined" && !localStorage.getItem(CALENDAR_TIP_KEY)) {
      setShowTip(true)
    }
  }, [onTimeSlotClick])

  const dismissTip = () => {
    localStorage.setItem(CALENDAR_TIP_KEY, "true")
    setShowTip(false)
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Onboarding-tips */}
      {showTip && (
        <div className="flex items-center justify-between bg-green-50 border-b border-green-200 px-3 py-2 text-sm text-green-800">
          <span>Tips: Tryck direkt i kalendern för att skapa en bokning</span>
          <button onClick={dismissTip} className="ml-2 text-green-600 hover:text-green-800 font-medium">OK</button>
        </div>
      )}

      {/* Header med veckodagar */}
      <div className={`grid ${gridCols} border-b`}>
        <div className="min-w-0 p-2 border-r bg-gray-50" /> {/* Tom cell för tidkolumnen */}
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
              className={`min-w-0 p-2 text-center border-r last:border-r-0 hover:bg-gray-100 transition-colors cursor-pointer ${
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
      <div ref={gridRef} className={`relative grid ${gridCols}`}>
        {/* Tidskolumn */}
        <div className="min-w-0 border-r">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className={`border-b last:border-b-0 text-xs text-gray-500 text-right pr-2 pt-0.5 ${
                viewMode === "day" ? "h-16" : viewMode === "3-day" ? "h-14" : "h-12"
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
              onClick={(e) => {
                if (!onTimeSlotClick) return
                const rect = e.currentTarget.getBoundingClientRect()
                const yPercent = ((e.clientY - rect.top) / rect.height) * 100
                const time = positionToTime(yPercent)
                const gridRect = gridRef.current!.getBoundingClientRect()
                const topPx = e.clientY - gridRect.top
                const dateLabel = format(day, "d MMM", { locale: sv })
                setSlotPopup({ date: dateKey, time, topPx, dateLabel })
              }}
              className={`min-w-0 relative border-r last:border-r-0 cursor-pointer group ${
                isClosed
                  ? hasException
                    ? "bg-orange-100"
                    : "bg-gray-100"
                  : ""
              }`}
            >
              {/* Hover-overlay för klickbar yta */}
              {!isClosed && onTimeSlotClick && (
                <div className="absolute inset-0 bg-green-100 opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none z-[1]" />
              )}

              {/* Timlinjer */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className={`border-b last:border-b-0 border-gray-100 ${
                    viewMode === "day" ? "h-16" : viewMode === "3-day" ? "h-14" : "h-12"
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

              {/* Nu-linje */}
              {isToday(day) && nowPosition !== null && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${nowPosition}%` }}
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                </div>
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

        {/* Kontextuell popup -- renderas utanför gridet för full bredd */}
        {slotPopup && (
          <div
            ref={popupRef}
            className="absolute left-[60px] right-0 z-20 px-4"
            style={{ top: `${slotPopup.topPx}px` }}
          >
            <div className="bg-white border border-green-300 rounded-lg shadow-lg px-3 py-2 text-sm max-w-sm mx-auto">
              <p className="text-gray-700 mb-1.5">
                Ny bokning {slotPopup.dateLabel} kl {slotPopup.time}?
              </p>
              <button
                className="w-full bg-green-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-green-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  onTimeSlotClick!(slotPopup.date, slotPopup.time)
                  setSlotPopup(null)
                }}
              >
                Skapa bokning
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
