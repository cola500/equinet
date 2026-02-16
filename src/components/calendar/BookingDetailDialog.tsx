"use client"

import { useState } from "react"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { CalendarBooking } from "@/types"
import { CustomerReviewDialog } from "@/components/review/CustomerReviewDialog"
import { StarRating } from "@/components/review/StarRating"
import { QuickNoteButton } from "@/components/booking/QuickNoteButton"
import Link from "next/link"

interface BookingDetailDialogProps {
  booking: CalendarBooking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate?: (bookingId: string, status: string, cancellationMessage?: string) => void
  onReviewSuccess?: () => void
  onNotesUpdate?: (bookingId: string, providerNotes: string | null) => void
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
  onReviewSuccess,
  onNotesUpdate,
}: BookingDetailDialogProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationMessage, setCancellationMessage] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [providerNotes, setProviderNotes] = useState("")
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  if (!booking) return null

  const isPaid = booking.payment?.status === "succeeded"

  const handleCancelClick = () => {
    setShowCancelDialog(true)
  }

  const handleCancelConfirm = async () => {
    if (!onStatusUpdate) return
    setIsCancelling(true)
    try {
      await onStatusUpdate(
        booking.id,
        "cancelled",
        cancellationMessage.trim() || undefined
      )
      setShowCancelDialog(false)
      setCancellationMessage("")
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCancelDialogClose = () => {
    setShowCancelDialog(false)
    setCancellationMessage("")
  }

  return (
    <>
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
            {booking.isManualBooking && (
              <span className="px-2 py-1 rounded text-sm bg-purple-100 text-purple-800">
                Manuell bokning
              </span>
            )}
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
                  {booking.horseId ? (
                    <Link
                      href={`/provider/horse-timeline/${booking.horseId}`}
                      className="font-medium text-green-700 underline hover:text-green-900"
                    >
                      {booking.horseName}
                    </Link>
                  ) : (
                    <span className="font-medium">{booking.horseName}</span>
                  )}
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
              {booking.customer.email && !booking.customer.email.endsWith('@ghost.equinet.se') && (
                <div>
                  <span className="text-gray-600">Email:</span>{" "}
                  <span className="font-medium">{booking.customer.email}</span>
                </div>
              )}
              {booking.customer.phone && (
                <div>
                  <span className="text-gray-600">Telefon:</span>{" "}
                  <a
                    href={`tel:${booking.customer.phone}`}
                    className="font-medium text-green-700 underline hover:text-green-900"
                  >
                    {booking.customer.phone}
                  </a>
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

          {/* Leverantorsanteckningar */}
          {["confirmed", "completed"].includes(booking.status) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-gray-700">
                  Dina anteckningar
                </h4>
                {!isEditingNotes && (
                  <QuickNoteButton
                    bookingId={booking.id}
                    variant="icon"
                    onNoteSaved={(cleanedText) => {
                      onNotesUpdate?.(booking.id, cleanedText)
                    }}
                  />
                )}
              </div>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <VoiceTextarea
                    value={providerNotes}
                    onChange={(value) => setProviderNotes(value)}
                    maxLength={2000}
                    placeholder="Skriv anteckningar om behandlingen..."
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {providerNotes.length}/2000
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingNotes(false)}
                        disabled={isSavingNotes}
                      >
                        Avbryt
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          setIsSavingNotes(true)
                          try {
                            const res = await fetch(
                              `/api/provider/bookings/${booking.id}/notes`,
                              {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  providerNotes: providerNotes.trim() || null,
                                }),
                              }
                            )
                            if (res.ok) {
                              setIsEditingNotes(false)
                              onNotesUpdate?.(
                                booking.id,
                                providerNotes.trim() || null
                              )
                            }
                          } finally {
                            setIsSavingNotes(false)
                          }
                        }}
                        disabled={isSavingNotes}
                      >
                        {isSavingNotes ? "Sparar..." : "Spara"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : booking.providerNotes ? (
                <div
                  className="p-3 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    setProviderNotes(booking.providerNotes || "")
                    setIsEditingNotes(true)
                  }}
                >
                  <p className="text-sm text-gray-800">
                    {booking.providerNotes}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Klicka for att redigera
                  </p>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProviderNotes("")
                    setIsEditingNotes(true)
                  }}
                >
                  Lagg till anteckning
                </Button>
              )}
            </div>
          ) : booking.providerNotes ? (
            <div className="p-3 bg-blue-50 rounded">
              <h4 className="font-semibold text-sm text-gray-700 mb-1">
                Dina anteckningar
              </h4>
              <p className="text-sm text-gray-800">
                {booking.providerNotes}
              </p>
            </div>
          ) : null}

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
                onClick={handleCancelClick}
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
                onClick={handleCancelClick}
                variant="outline"
                className="flex-1"
              >
                Avboka
              </Button>
            </div>
          )}

          {/* Customer Review section for completed bookings */}
          {booking.status === "completed" && (
            <div className="pt-2 border-t">
              {booking.customerReview ? (
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-700">Din recension av kund</span>
                  <div className="flex items-center gap-2">
                    <StarRating rating={booking.customerReview.rating} readonly size="sm" />
                    {booking.customerReview.comment && (
                      <span className="text-sm text-gray-500">
                        - {booking.customerReview.comment}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReviewDialog(true)}
                >
                  Recensera kund
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Customer Review Dialog */}
    {booking && showReviewDialog && (
      <CustomerReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        bookingId={booking.id}
        customerName={`${booking.customer.firstName} ${booking.customer.lastName}`}
        serviceName={booking.service.name}
        onSuccess={() => {
          setShowReviewDialog(false)
          onReviewSuccess?.()
        }}
      />
    )}

    {/* Cancel Confirmation Dialog */}
    <AlertDialog open={showCancelDialog} onOpenChange={handleCancelDialogClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Avboka bokning?</AlertDialogTitle>
          <AlertDialogDescription>
            Kunden kommer att meddelas om avbokningen. Du kan skicka ett valfritt meddelande.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label htmlFor="cancel-message-calendar">Meddelande till kund (valfritt)</Label>
          <VoiceTextarea
            id="cancel-message-calendar"
            placeholder="T.ex. anledning till avbokningen..."
            value={cancellationMessage}
            onChange={(value) => setCancellationMessage(value)}
            maxLength={500}
            className="mt-1.5"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">{cancellationMessage.length}/500</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCancelling}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancelConfirm}
            disabled={isCancelling}
            className="bg-red-600 hover:bg-red-700"
          >
            {isCancelling ? "Avbokar..." : "Ja, avboka"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
