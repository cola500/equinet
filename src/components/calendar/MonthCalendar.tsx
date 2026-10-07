"use client"

import { useMemo, useState, useRef, useEffect, useLayoutEffect } from "react"
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
import { getBookingStatusStyle } from "@/components/booking/booking-status"

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

// Day popup width, centred on its `left` via translateX(-50%). Applied as an inline
// style below so the clamp and the rendered width cannot drift apart.
const POPUP_WIDTH_PX = 192

// Keep the popup inside the grid: clamp its centre to [half width, gridWidth - half width].
// Without this, popups opened from the first/last column stick out of the screen.
export function clampPopupLeft(leftPx: number, gridWidth: number): number {
  const half = POPUP_WIDTH_PX / 2
  if (gridWidth <= POPUP_WIDTH_PX) return gridWidth / 2
  return Math.min(Math.max(leftPx, half), gridWidth - half)
}

// Minimum gap between the popup and the top/bottom edge of the grid it is positioned in
export const POPUP_EDGE_MARGIN_PX = 8

// Vertical placement, relative to the grid (the popup's positioned ancestor, whose
// bottom edge is also the clip edge). Prefer below the anchor; flip above it when the
// popup does not fit below; as a last resort clamp it inside the grid.
export function resolvePopupTop({
  belowTopPx,
  aboveBottomPx,
  popupHeight,
  containerHeight,
}: {
  /** Top edge of the popup when placed below the anchor */
  belowTopPx: number
  /** Where the popup's bottom edge should end when placed above the anchor */
  aboveBottomPx: number
  popupHeight: number
  containerHeight: number
}): number {
  const margin = POPUP_EDGE_MARGIN_PX
  const maxTop = containerHeight - popupHeight - margin
  if (belowTopPx <= maxTop) return Math.max(belowTopPx, margin)
  const aboveTop = aboveBottomPx - popupHeight
  if (aboveTop >= margin) return aboveTop
  return Math.max(margin, Math.min(belowTopPx, maxTop))
}

// Konvertera JS getDay() (0=Söndag) till vårt dayOfWeek (0=Måndag)
function jsDayToOurDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
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
  const popupButtonRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const focusPopupOnOpenRef = useRef(false)
  // Date button that opened the popup, so focus can return there when it closes
  const popupOriginRef = useRef<HTMLElement | null>(null)
  const [dayPopup, setDayPopup] = useState<{
    date: string
    label: string
    belowTopPx: number
    aboveBottomPx: number
    leftPx: number
  } | null>(null)
  // Final top once the popup's real height is known (measured before paint)
  const [popupTop, setPopupTop] = useState<number | null>(null)

  // Stäng popup vid navigation
  useEffect(() => {
    setDayPopup(null)
  }, [currentDate])

  // Measure the popup and the grid it is positioned in, then place it below the anchor,
  // above it, or clamped inside the grid. Runs before paint so there is no visible jump.
  useLayoutEffect(() => {
    const grid = gridRef.current
    const popup = popupRef.current
    if (!dayPopup || !grid || !popup) {
      setPopupTop(null)
      return
    }
    setPopupTop(
      resolvePopupTop({
        belowTopPx: dayPopup.belowTopPx,
        aboveBottomPx: dayPopup.aboveBottomPx,
        popupHeight: popup.getBoundingClientRect().height,
        containerHeight: grid.getBoundingClientRect().height,
      })
    )
  }, [dayPopup])

  // Tangentbordsöppnad popup: flytta fokus till första knappen
  useEffect(() => {
    if (dayPopup && focusPopupOnOpenRef.current) {
      focusPopupOnOpenRef.current = false
      popupButtonRef.current?.focus()
    }
  }, [dayPopup])

  // Stäng popup vid klick utanför (ref-check, samma mönster som WeekCalendar)
  // och med Escape (fokus tillbaka till datumknappen)
  useEffect(() => {
    if (!dayPopup) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return
      setDayPopup(null)
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setDayPopup(null)
      popupOriginRef.current?.focus()
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 0)
    document.addEventListener("keydown", handleEscape)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
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

          const isInteractive = !!(onTimeSlotClick || onDateClick)
          const dayLabel = format(day, "d MMMM", { locale: sv })
          const dayNumberClass = `text-sm font-medium inline-flex items-center justify-center ${
            today
              ? "bg-green-600 text-white rounded-full w-7 h-7"
              : inMonth
                ? "text-gray-900"
                : "text-gray-400"
          }`

          return (
            <div
              key={dateKey}
              onClick={
                isInteractive
                  ? (e) => {
                      // Mouse convenience: the whole cell opens the popup at the click point.
                      // Keyboard and screen reader users use the date button below.
                      e.stopPropagation()
                      popupOriginRef.current = e.currentTarget.querySelector<HTMLElement>(
                        "button[data-day-button]"
                      )
                      if (onTimeSlotClick) {
                        const label = format(day, "d MMMM", { locale: sv })
                        const gridRect = gridRef.current!.getBoundingClientRect()
                        const anchorY = e.clientY - gridRect.top
                        const leftPx = clampPopupLeft(e.clientX - gridRect.left, gridRect.width)
                        setDayPopup({ date: dateKey, label, belowTopPx: anchorY, aboveBottomPx: anchorY, leftPx })
                      } else {
                        onDateClick?.(dateKey)
                      }
                    }
                  : undefined
              }
              className={`relative min-h-[80px] md:min-h-[100px] p-0.5 md:p-2 border-b border-r text-left transition-colors ${
                isInteractive ? "hover:bg-gray-100 cursor-pointer" : ""
              } ${bgClass}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                {isInteractive ? (
                  <button
                    type="button"
                    data-day-button
                    aria-label={onTimeSlotClick ? `Ny bokning ${dayLabel}` : `Ändra tillgänglighet ${dayLabel}`}
                    onClick={(e) => {
                      // Pointer clicks (detail > 0) bubble to the cell, which opens the popup at
                      // the click point. Clicks from keyboard or assistive tech have detail 0.
                      if (e.detail > 0) return
                      e.stopPropagation()
                      popupOriginRef.current = e.currentTarget
                      if (onTimeSlotClick) {
                        // Popup centred on the date button (no pointer position for keyboard)
                        const btnRect = e.currentTarget.getBoundingClientRect()
                        const gridRect = gridRef.current!.getBoundingClientRect()
                        const belowTopPx = btnRect.bottom - gridRect.top
                        const aboveBottomPx = btnRect.top - gridRect.top
                        const leftPx = clampPopupLeft(
                          btnRect.left - gridRect.left + btnRect.width / 2,
                          gridRect.width
                        )
                        focusPopupOnOpenRef.current = true
                        setDayPopup({ date: dateKey, label: dayLabel, belowTopPx, aboveBottomPx, leftPx })
                      } else {
                        onDateClick?.(dateKey)
                      }
                    }}
                    className={`${dayNumberClass} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600`}
                  >
                    {format(day, "d")}
                  </button>
                ) : (
                  <span className={dayNumberClass}>{format(day, "d")}</span>
                )}
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
                    const status = getBookingStatusStyle(booking.status, isPaid)
                    const StatusIcon = status.icon
                    const serviceName = booking.service?.name || "Bokning"
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        aria-label={`${booking.startTime} ${serviceName}, ${status.label}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onBookingClick(booking)
                        }}
                        className={`flex w-full items-center gap-0.5 md:gap-1 overflow-hidden text-left text-[10px] md:text-xs rounded px-0.5 md:px-1 py-0.5 cursor-pointer hover:opacity-80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600 ${status.dot} ${
                          isPaid ? "text-white" : ""
                        }`}
                      >
                        {/* Status is also conveyed by icon + label, not only by colour */}
                        {StatusIcon && (
                          <StatusIcon className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate hidden md:inline">
                          {booking.startTime} {serviceName}
                        </span>
                        <span className="md:hidden">{booking.startTime}</span>
                      </button>
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
            role="dialog"
            aria-label={`Ny bokning ${dayPopup.label}`}
            className="absolute z-30 -translate-x-1/2"
            style={{ top: `${popupTop ?? dayPopup.belowTopPx}px`, left: `${dayPopup.leftPx}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white border border-green-300 rounded-lg shadow-lg px-4 py-3 text-sm" style={{ width: POPUP_WIDTH_PX }}>
              <p className="text-gray-700 mb-2 font-medium">
                {dayPopup.label}
              </p>
              <button
                ref={popupButtonRef}
                className="w-full bg-green-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-green-700 transition-colors"
                onClick={() => {
                  // Focus the date button first so a dialog opened below returns focus here on close
                  popupOriginRef.current?.focus()
                  onTimeSlotClick!(dayPopup.date, "")
                  setDayPopup(null)
                }}
              >
                Skapa bokning
              </button>
              <button
                className="w-full mt-1 text-gray-600 hover:text-gray-800 text-xs py-1"
                onClick={() => {
                  popupOriginRef.current?.focus()
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
