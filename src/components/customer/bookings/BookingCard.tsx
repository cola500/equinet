"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "@/components/review/StarRating"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import type { CombinedBooking, Booking } from "./types"

interface BookingCardProps {
  booking: CombinedBooking
  index: number
  payingBookingId: string | null
  deletingReviewId: string | null
  onPayment: (bookingId: string) => void
  onCancel: (id: string, type: "fixed" | "flexible") => void
  onReview: (booking: Booking) => void
  onReschedule: (booking: Booking) => void
  onDeleteReview: (reviewId: string) => void
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-blue-100 text-blue-800",
    no_show: "bg-orange-100 text-orange-800",
    in_route: "bg-purple-100 text-purple-800",
  }

  const labels: Record<string, string> = {
    pending: "Väntar på svar",
    confirmed: "Bekräftad",
    cancelled: "Avbokad",
    completed: "Genomförd",
    no_show: "Ej infunnit",
    in_route: "Inplanerad i rutt",
  }

  return (
    <span
      className={`text-xs px-2 py-1 rounded ${styles[status] || "bg-gray-100 text-gray-800"}`}
    >
      {labels[status] || status}
    </span>
  )
}

function getStatusBorderClass(status: string): string {
  const borders: Record<string, string> = {
    pending: "border-l-4 border-l-yellow-400",
    confirmed: "border-l-4 border-l-green-500",
    cancelled: "border-l-4 border-l-red-400",
    completed: "border-l-4 border-l-blue-400",
    no_show: "border-l-4 border-l-orange-400",
    in_route: "border-l-4 border-l-purple-500",
  }
  return borders[status] || ""
}

export function BookingCard({
  booking,
  index,
  payingBookingId,
  deletingReviewId,
  onPayment,
  onCancel,
  onReview,
  onReschedule,
  onDeleteReview,
}: BookingCardProps) {
  return (
    <Card
      data-testid="booking-item"
      className={`animate-fade-in-up ${getStatusBorderClass(booking.status)}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {booking.type === "fixed" ? (
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{booking.service.name}</CardTitle>
                  {booking.bookingSeriesId && (
                    <Badge
                      className="bg-purple-100 text-purple-800"
                      variant="secondary"
                    >
                      Återkommande
                    </Badge>
                  )}
                  {booking.routeOrderId && (
                    <Badge
                      className="bg-blue-100 text-blue-800"
                      variant="secondary"
                    >
                      Via rutt
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {booking.provider.businessName}
                </CardDescription>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{booking.serviceType}</CardTitle>
                  <Badge variant="outline" data-testid="booking-type-badge">
                    Flexibel tid
                  </Badge>
                </div>
                {booking.routeStops && booking.routeStops.length > 0 ? (
                  <CardDescription>
                    {booking.routeStops[0].route.provider.businessName}
                  </CardDescription>
                ) : (
                  <CardDescription>
                    Väntar på ruttplanering
                  </CardDescription>
                )}
              </div>
            )}
          </div>
          {getStatusBadge(booking.status)}
        </div>
      </CardHeader>
      <CardContent>
        {booking.type === "fixed" ? (
          <FixedBookingContent booking={booking} />
        ) : (
          <FlexibleBookingContent booking={booking} />
        )}

        {/* Payment and action buttons for fixed bookings */}
        {booking.type === "fixed" && (
          <BookingActions
            booking={booking}
            payingBookingId={payingBookingId}
            onPayment={onPayment}
            onCancel={onCancel}
            onReschedule={onReschedule}
          />
        )}

        {/* Review section for completed fixed bookings */}
        {booking.type === "fixed" && booking.status === "completed" && (
          <ReviewSection
            booking={booking}
            deletingReviewId={deletingReviewId}
            onReview={onReview}
            onDeleteReview={onDeleteReview}
          />
        )}

        {/* Cancel button for flexible bookings */}
        {booking.type === "flexible" &&
          (booking.status === "pending" || booking.status === "in_route") && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="destructive"
                size="sm"
                className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                onClick={() => onCancel(booking.id, "flexible")}
              >
                Avboka denna bokning
              </Button>
            </div>
          )}
      </CardContent>
    </Card>
  )
}

function FixedBookingContent({ booking }: { booking: Booking }) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-600">Datum:</span>{" "}
            <span className="font-medium">
              {format(new Date(booking.bookingDate), "d MMMM yyyy", {
                locale: sv,
              })}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Tid:</span>{" "}
            <span className="font-medium">
              {booking.startTime} - {booking.endTime}
            </span>
          </div>
          {(booking.horse || booking.horseName) && (
            <div className="text-sm">
              <span className="text-gray-600">Häst:</span>{" "}
              <span className="font-medium">
                {booking.horse?.name || booking.horseName}
              </span>
              {booking.horse?.breed && (
                <span className="text-gray-500 ml-1">
                  ({booking.horse.breed})
                </span>
              )}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-600">Pris:</span>{" "}
            <span className="font-medium">{booking.service.price} kr</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Varaktighet:</span>{" "}
            <span className="font-medium">
              {booking.service.durationMinutes} min
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Kontakt:</span>{" "}
            <span className="font-medium">
              {booking.provider.user.firstName}{" "}
              {booking.provider.user.lastName}
            </span>
          </div>
        </div>
      </div>
      {booking.customerNotes && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            <strong>Dina kommentarer:</strong> {booking.customerNotes}
          </p>
        </div>
      )}
      {booking.status === "cancelled" && booking.cancellationMessage && (
        <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
          <p className="text-sm text-red-800">
            <strong>Meddelande vid avbokning:</strong>{" "}
            {booking.cancellationMessage}
          </p>
        </div>
      )}
    </>
  )
}

function FlexibleBookingContent({
  booking,
}: {
  booking: Extract<import("./types").CombinedBooking, { type: "flexible" }>
}) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm" data-testid="booking-period">
            <span className="text-gray-600">Period:</span>{" "}
            <span className="font-medium">
              {format(new Date(booking.dateFrom), "d MMM", { locale: sv })} -{" "}
              {format(new Date(booking.dateTo), "d MMM yyyy", { locale: sv })}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Prioritet:</span>{" "}
            <Badge
              variant={
                booking.priority === "urgent" ? "destructive" : "secondary"
              }
            >
              {booking.priority === "urgent" ? "Akut" : "Normal"}
            </Badge>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Antal hästar:</span>{" "}
            <span className="font-medium">{booking.numberOfHorses}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-600">Adress:</span>{" "}
            <span className="font-medium">{booking.address}</span>
          </div>
          {booking.routeStops &&
            booking.routeStops.length > 0 &&
            booking.routeStops[0].estimatedArrival && (
              <div className="text-sm">
                <span className="text-gray-600">Beräknad ankomst:</span>{" "}
                <span className="font-medium">
                  {format(
                    new Date(booking.routeStops[0].estimatedArrival),
                    "d MMM HH:mm",
                    { locale: sv }
                  )}
                </span>
              </div>
            )}
          {booking.routeStops && booking.routeStops.length > 0 && (
            <div className="text-sm">
              <span className="text-gray-600">Rutt:</span>{" "}
              <span className="font-medium">
                {booking.routeStops[0].route.routeName}
              </span>
            </div>
          )}
        </div>
      </div>
      {booking.specialInstructions && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">
            <strong>Instruktioner:</strong> {booking.specialInstructions}
          </p>
        </div>
      )}
    </>
  )
}

function BookingActions({
  booking,
  payingBookingId,
  onPayment,
  onCancel,
  onReschedule,
}: {
  booking: Booking
  payingBookingId: string | null
  onPayment: (bookingId: string) => void
  onCancel: (id: string, type: "fixed" | "flexible") => void
  onReschedule: (booking: Booking) => void
}) {
  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {/* Payment status and actions */}
        {booking.payment?.status === "succeeded" ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800">Betald</Badge>
            {booking.payment.invoiceNumber && (
              <span className="text-sm text-gray-500">
                Kvitto: {booking.payment.invoiceNumber}
              </span>
            )}
            {booking.payment.invoiceUrl && (
              <a
                href={booking.payment.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Ladda ner kvitto
              </a>
            )}
          </div>
        ) : booking.status === "confirmed" ||
          booking.status === "completed" ? (
          <Button
            variant="default"
            size="sm"
            className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
            onClick={() => onPayment(booking.id)}
            disabled={payingBookingId === booking.id}
          >
            {payingBookingId === booking.id ? (
              <>
                <span className="animate-spin mr-2">...</span>
                Bearbetar...
              </>
            ) : (
              <>Betala {booking.service.price} kr</>
            )}
          </Button>
        ) : null}

        {/* Reschedule button */}
        {(booking.status === "pending" || booking.status === "confirmed") &&
          booking.payment?.status !== "succeeded" &&
          booking.provider.rescheduleEnabled &&
          booking.rescheduleCount < booking.provider.maxReschedules && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
              onClick={() => onReschedule(booking)}
            >
              Omboka
            </Button>
          )}

        {/* Cancel button */}
        {(booking.status === "pending" || booking.status === "confirmed") &&
          booking.payment?.status !== "succeeded" && (
            <Button
              variant="destructive"
              size="sm"
              className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
              onClick={() => onCancel(booking.id, "fixed")}
            >
              Avboka
            </Button>
          )}
      </div>
    </div>
  )
}

function ReviewSection({
  booking,
  deletingReviewId,
  onReview,
  onDeleteReview,
}: {
  booking: Booking
  deletingReviewId: string | null
  onReview: (booking: Booking) => void
  onDeleteReview: (reviewId: string) => void
}) {
  return (
    <div className="mt-3 pt-3 border-t">
      {booking.review ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Din recension:
              </span>
              <StarRating rating={booking.review.rating} readonly size="sm" />
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] sm:min-h-0 sm:h-7 px-2 text-gray-500"
                onClick={() => onReview(booking)}
              >
                Redigera
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] sm:min-h-0 sm:h-7 px-2 text-red-500 hover:text-red-600"
                onClick={() => onDeleteReview(booking.review!.id)}
                disabled={deletingReviewId === booking.review.id}
              >
                {deletingReviewId === booking.review.id ? "..." : "Ta bort"}
              </Button>
            </div>
          </div>
          {booking.review.comment && (
            <p className="text-sm text-gray-600 italic">
              &ldquo;{booking.review.comment}&rdquo;
            </p>
          )}
          {booking.review.reply && (
            <div className="mt-2 pl-3 border-l-2 border-green-300 bg-green-50 p-2 rounded-r">
              <p className="text-xs font-medium text-green-800 mb-1">
                Svar från leverantören
              </p>
              <p className="text-sm text-green-700">
                {booking.review.reply}
              </p>
            </div>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
          onClick={() => onReview(booking)}
        >
          Lämna recension
        </Button>
      )}
    </div>
  )
}
