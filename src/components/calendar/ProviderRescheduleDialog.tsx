"use client"

import { useState } from "react"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { CalendarBooking } from "@/types"

interface ProviderRescheduleDialogProps {
  booking: CalendarBooking
  open: boolean
  onOpenChange: (open: boolean) => void
  onReschedule: (bookingId: string, bookingDate: string, startTime: string) => Promise<void>
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + minutes
  const endH = Math.floor(total / 60)
  const endM = total % 60
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`
}

export function ProviderRescheduleDialog({
  booking,
  open,
  onOpenChange,
  onReschedule,
}: ProviderRescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(booking.bookingDate)
  )
  const [startTime, setStartTime] = useState(booking.startTime)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const durationMinutes = booking.service.durationMinutes
  const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
  const isValidTime = timePattern.test(startTime)
  const computedEndTime = isValidTime ? addMinutes(startTime, durationMinutes) : null

  const handleSave = async () => {
    if (!selectedDate || !isValidTime) return

    setIsSaving(true)
    setError(null)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      await onReschedule(booking.id, dateStr, startTime)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte boka om")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ändra datum och tid</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Datum</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              locale={sv}
              className="rounded border p-2"
            />
            {selectedDate && (
              <p className="text-sm text-gray-600 mt-1">
                {format(selectedDate, "d MMMM yyyy", { locale: sv })}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="reschedule-start-time">Starttid</Label>
            <Input
              id="reschedule-start-time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="HH:MM"
              className={!isValidTime && startTime ? "border-red-400" : ""}
            />
            {!isValidTime && startTime && (
              <p className="text-xs text-red-600">Ange tid i format HH:MM (t.ex. 10:00)</p>
            )}
          </div>

          {computedEndTime && (
            <div className="p-3 bg-gray-50 rounded text-sm">
              <span className="text-gray-600">Beräknad sluttid: </span>
              <span className="font-medium">{startTime} – {computedEndTime}</span>
              <span className="text-gray-500 ml-1">({durationMinutes} min)</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 p-2 bg-red-50 rounded">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedDate || !isValidTime || isSaving}
          >
            {isSaving ? "Sparar..." : "Spara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
