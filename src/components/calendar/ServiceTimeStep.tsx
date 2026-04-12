"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import type { CalendarBooking } from "@/types"

interface ServiceTimeStepProps {
  services: { id: string; name: string; price: number; durationMinutes: number }[]
  serviceId: string
  onServiceChange: (id: string) => void
  bookingDate: string
  onBookingDateChange: (date: string) => void
  startTime: string
  onStartTimeChange: (time: string) => void
  endTime: string
  bookings?: CalendarBooking[]
}

export function ServiceTimeStep({
  services,
  serviceId,
  onServiceChange,
  bookingDate,
  onBookingDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  bookings,
}: ServiceTimeStepProps) {
  const dayBookings = useMemo(() => {
    if (!bookingDate || !bookings) return []
    return bookings
      .filter(b => b.bookingDate.startsWith(bookingDate))
      .filter(b => b.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [bookingDate, bookings])

  const hasOverlap = useMemo(() => {
    if (!startTime || !endTime || !dayBookings.length) return false
    return dayBookings.some(b =>
      startTime < b.endTime && endTime > b.startTime
    )
  }, [startTime, endTime, dayBookings])

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="service">Tjänst</Label>
        <select
          id="service"
          value={serviceId}
          onChange={(e) => onServiceChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Välj tjänst...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMinutes} min, {s.price} kr)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label htmlFor="date">Datum</Label>
          <input
            id="date"
            type="date"
            value={bookingDate}
            onChange={(e) => onBookingDateChange(e.target.value)}
            onBlur={(e) => onBookingDateChange(e.target.value)}
            className="mt-1 flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="start">Starttid</Label>
          <select
            id="start"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Välj tid...</option>
            {Array.from({ length: (21 - 6) * 4 }, (_, i) => {
              const h = Math.floor(i / 4) + 6
              const m = (i % 4) * 15
              const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
              return <option key={val} value={val}>{val}</option>
            })}
          </select>
          {endTime && (
            <p className="text-xs text-gray-500 mt-1">Sluttid: {endTime}</p>
          )}
          {hasOverlap && (
            <p className="text-xs text-red-600 mt-1">
              Tiden krockar med en befintlig bokning
            </p>
          )}
        </div>
      </div>

      {bookingDate && dayBookings.length > 0 && (
        <div className="rounded-md border bg-gray-50 p-2">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Bokningar denna dag
          </p>
          <div className="space-y-1">
            {dayBookings.map(b => (
              <div key={b.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-gray-700">
                  {b.startTime}&#8209;{b.endTime}
                </span>
                <span className="text-gray-500 truncate">
                  {b.service.name} - {b.customer.firstName} {b.customer.lastName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
