"use client"

import { useState, useMemo } from "react"
import { addWeeks, subWeeks, startOfWeek, format } from "date-fns"
import { CalendarHeader } from "@/components/calendar/CalendarHeader"
import { DayColumn } from "./DayColumn"
import {
  useWeekAvailability,
  DayAvailability,
  CustomerLocation,
  SlotWithReason,
} from "@/hooks/useWeekAvailability"
import { calculateAvailableSlots, TimeSlot } from "@/lib/utils/slotCalculator"

interface CustomerBookingCalendarProps {
  providerId: string
  serviceDurationMinutes: number
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
  initialDate?: Date
  customerLocation?: CustomerLocation
  dateRange?: { from: string; to: string }
}

interface SelectedSlot {
  date: string
  startTime: string
}

/**
 * Customer-facing calendar for booking time slots
 *
 * Features:
 * - Week navigation
 * - Shows available/booked slots
 * - Travel time validation (when customerLocation is provided)
 * - Responsive (7 columns on desktop, tabs on mobile)
 */
export function CustomerBookingCalendar({
  providerId,
  serviceDurationMinutes,
  onSlotSelect,
  initialDate = new Date(),
  customerLocation,
  dateRange,
}: CustomerBookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(
    startOfWeek(initialDate, { weekStartsOn: 1 })
  )
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)

  const { weekData, isLoading, error } = useWeekAvailability(
    providerId,
    currentDate,
    {
      customerLocation,
      serviceDurationMinutes,
    }
  )

  // Use API-provided slots if available, otherwise calculate locally
  const daysWithSlots = useMemo(() => {
    const now = new Date()

    return weekData.map((day: DayAvailability) => {
      // If dateRange is set, mark days outside range as closed
      if (dateRange && (day.date < dateRange.from || day.date > dateRange.to)) {
        return {
          ...day,
          isClosed: true,
          closedReason: "outside_range" as const,
          slots: [] as TimeSlot[],
        }
      }

      if (day.isClosed || !day.openingTime || !day.closingTime) {
        return {
          ...day,
          slots: [] as TimeSlot[],
        }
      }

      // If API provides pre-calculated slots (with travel time), use them
      if (day.slots && day.slots.length > 0) {
        // Convert SlotWithReason to TimeSlot for DayColumn compatibility
        const slots: TimeSlot[] = day.slots.map((s: SlotWithReason) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          isAvailable: s.isAvailable,
          unavailableReason: s.unavailableReason,
        }))
        return {
          ...day,
          slots,
        }
      }

      // Fallback: calculate locally (no travel time validation)
      const slots = calculateAvailableSlots({
        openingTime: day.openingTime,
        closingTime: day.closingTime,
        bookedSlots: day.bookedSlots.map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
        })),
        serviceDurationMinutes,
        date: day.date,
        currentDateTime: now,
      })

      return {
        ...day,
        slots,
      }
    })
  }, [weekData, serviceDurationMinutes, dateRange])

  const handlePreviousWeek = () => {
    setCurrentDate((prev) => subWeeks(prev, 1))
    setSelectedSlot(null)
  }

  const handleNextWeek = () => {
    setCurrentDate((prev) => addWeeks(prev, 1))
    setSelectedSlot(null)
  }

  const handleToday = () => {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
    setSelectedSlot(null)
  }

  const handleSlotSelect = (
    date: string,
    startTime: string,
    endTime: string
  ) => {
    setSelectedSlot({ date, startTime })
    onSlotSelect(date, startTime, endTime)
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Laddar tillgänglighet...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>{error}</p>
      </div>
    )
  }

  const formatDateRange = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })

  return (
    <div className="space-y-4">
      {dateRange && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Leverantören besöker ditt område {formatDateRange(dateRange.from)} - {formatDateRange(dateRange.to)}
          </p>
        </div>
      )}

      <CalendarHeader
        currentDate={currentDate}
        onPreviousWeek={handlePreviousWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
      />

      {/* Desktop: 7 columns */}
      <div className="hidden md:grid md:grid-cols-7 gap-2">
        {daysWithSlots.map((day) => (
          <DayColumn
            key={day.date}
            date={day.date}
            slots={day.slots}
            isClosed={day.isClosed}
            selectedTime={
              selectedSlot?.date === day.date ? selectedSlot.startTime : null
            }
            onSlotSelect={handleSlotSelect}
          />
        ))}
      </div>

      {/* Mobile: Tabs + single day */}
      <MobileDayView
        days={daysWithSlots}
        selectedSlot={selectedSlot}
        onSlotSelect={handleSlotSelect}
      />
    </div>
  )
}

interface DayWithSlots extends DayAvailability {
  slots: TimeSlot[]
}

interface MobileDayViewProps {
  days: DayWithSlots[]
  selectedSlot: SelectedSlot | null
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
}

function MobileDayView({
  days,
  selectedSlot,
  onSlotSelect,
}: MobileDayViewProps) {
  // Default to today (or first future day) instead of always Monday
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const defaultDay = days.findIndex((d) => d.date >= todayStr)
  const [activeDay, setActiveDay] = useState(defaultDay >= 0 ? defaultDay : 0)

  if (days.length === 0) return null

  const currentDay = days[activeDay]

  return (
    <div className="md:hidden">
      {/* Day tabs */}
      <div className="flex overflow-x-auto gap-1 pb-2 mb-4">
        {days.map((day, index) => {
          const date = new Date(day.date)
          const dayName = date.toLocaleDateString("sv-SE", { weekday: "short" })
          const dayNum = date.getDate()
          const isActive = index === activeDay

          return (
            <button
              key={day.date}
              onClick={() => setActiveDay(index)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-center min-w-[60px] ${
                isActive
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              <div className="text-xs capitalize">{dayName}</div>
              <div className="text-lg font-bold">{dayNum}</div>
            </button>
          )
        })}
      </div>

      {/* Current day slots */}
      <DayColumn
        date={currentDay.date}
        slots={currentDay.slots}
        isClosed={currentDay.isClosed}
        selectedTime={
          selectedSlot?.date === currentDay.date ? selectedSlot.startTime : null
        }
        onSlotSelect={onSlotSelect}
      />
    </div>
  )
}
