"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { AlertTriangle } from "lucide-react"

interface RescheduleBooking {
  id: string
  bookingDate: string
  startTime: string
  service: {
    name: string
    durationMinutes: number
  }
  provider: {
    businessName: string
    rescheduleRequiresApproval: boolean
    user: {
      firstName: string
      lastName: string
    }
  }
}

interface RescheduleDialogProps {
  booking: RescheduleBooking
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RescheduleDialog({ booking, open, onOpenChange, onSuccess }: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(booking.bookingDate)
  )
  const [selectedTime, setSelectedTime] = useState(booking.startTime)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Välj datum och tid")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingDate: format(selectedDate, "yyyy-MM-dd"),
          startTime: selectedTime,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Ombokningen misslyckades")
      }

      toast.success(
        booking.provider.rescheduleRequiresApproval
          ? "Ombokning skickad -- inväntar godkännande"
          : "Bokningen har ombokats"
      )
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte omboka")
    } finally {
      setIsSubmitting(false)
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Omboka</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Välj nytt datum och tid för {booking.service.name} hos {booking.provider.businessName}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          {/* Current booking info */}
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p className="text-gray-500">Nuvarande tid:</p>
            <p className="font-medium">
              {format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv })} kl {booking.startTime}
            </p>
          </div>

          {/* Date picker */}
          <div>
            <Label className="text-sm font-medium">Välj nytt datum</Label>
            <div className="mt-2 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < tomorrow}
                locale={sv}
              />
            </div>
          </div>

          {/* Time picker */}
          <div>
            <Label htmlFor="reschedule-time" className="text-sm font-medium">
              Välj ny tid
            </Label>
            <Input
              id="reschedule-time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Approval warning */}
          {booking.provider.rescheduleRequiresApproval && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>Ombokningen kräver godkännande från leverantören innan den bekräftas.</p>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={isSubmitting || !selectedDate || !selectedTime}
          >
            {isSubmitting ? "Ombokar..." : "Bekräfta ombokning"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
