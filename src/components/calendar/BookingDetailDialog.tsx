"use client"

import { format } from "date-fns"
import { sv } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CalendarBooking } from "@/types"

interface BookingDetailDialogProps {
  booking: CalendarBooking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate?: (bookingId: string, status: string) => void
}

function getStatusLabel(status: string, isPaid: boolean): string {
  if (isPaid) return "Betald"

  const labels: Record<string, string> = {
    pending: "Väntar på svar",
    confirmed: "Bekräftad",
    completed: "Genomförd",
    cancelled: "Avbokad",
  }

  return labels[status] || status
}

function getStatusStyles(status: string, isPaid: boolean): string {
  if (isPaid) {
    return "bg-emerald-100 text-emerald-800"
  }

  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
  }

  return styles[status] || "bg-gray-100 text-gray-800"
}

export function BookingDetailDialog({
  booking,
  open,
  onOpenChange,
  onStatusUpdate,
}: BookingDetailDialogProps) {
  if (!booking) return null

  const isPaid = booking.payment?.status === "succeeded"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{booking.service.name}</DialogTitle>
          <DialogDescription>
            {booking.customer.firstName} {booking.customer.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-sm ${getStatusStyles(
                booking.status,
                isPaid
              )}`}
            >
              {getStatusLabel(booking.status, isPaid)}
            </span>
          </div>

          {/* Bokningsdetaljer */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">
              Bokningsdetaljer
            </h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-600">Datum:</span>{" "}
                <span className="font-medium">
                  {format(new Date(booking.bookingDate), "d MMMM yyyy", {
                    locale: sv,
                  })}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tid:</span>{" "}
                <span className="font-medium">
                  {booking.startTime} - {booking.endTime}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Pris:</span>{" "}
                <span className="font-medium">{booking.service.price} kr</span>
              </div>
              {booking.horseName && (
                <div>
                  <span className="text-gray-600">Häst:</span>{" "}
                  <span className="font-medium">{booking.horseName}</span>
                </div>
              )}
              {booking.payment?.invoiceNumber && (
                <div>
                  <span className="text-gray-600">Kvittonr:</span>{" "}
                  <span className="font-medium">
                    {booking.payment.invoiceNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Kundinformation */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">
              Kundinformation
            </h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-600">Email:</span>{" "}
                <span className="font-medium">{booking.customer.email}</span>
              </div>
              {booking.customer.phone && (
                <div>
                  <span className="text-gray-600">Telefon:</span>{" "}
                  <span className="font-medium">{booking.customer.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Hästinfo */}
          {booking.horseInfo && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-gray-700">Hästinfo</h4>
              <p className="text-sm text-gray-800">{booking.horseInfo}</p>
            </div>
          )}

          {/* Kundkommentarer */}
          {booking.customerNotes && (
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                <strong>Kundkommentarer:</strong> {booking.customerNotes}
              </p>
            </div>
          )}

          {/* Action-knappar */}
          {onStatusUpdate && booking.status === "pending" && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={() => onStatusUpdate(booking.id, "confirmed")}
                className="flex-1"
              >
                Acceptera
              </Button>
              <Button
                onClick={() => onStatusUpdate(booking.id, "cancelled")}
                variant="destructive"
                className="flex-1"
              >
                Avböj
              </Button>
            </div>
          )}

          {onStatusUpdate && booking.status === "confirmed" && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={() => onStatusUpdate(booking.id, "completed")}
                className="flex-1"
              >
                Markera som genomförd
              </Button>
              <Button
                onClick={() => onStatusUpdate(booking.id, "cancelled")}
                variant="outline"
                className="flex-1"
              >
                Avboka
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
