"use client"

import { useBookingFlowContext } from "./BookingFlowContext"

export function BookingSummaryCard() {
  const {
    selectedService,
    isFlexibleBooking,
    bookingForm,
    flexibleForm,
    customerHorses,
    isRecurring,
    intervalWeeks,
    totalOccurrences,
  } = useBookingFlowContext()

  if (!selectedService) return null

  return (
    <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">Tjänst</p>
        <p className="font-medium">{selectedService.name}</p>
        <p className="text-sm text-gray-600">{selectedService.price} kr ({selectedService.durationMinutes} min)</p>
      </div>
      {!isFlexibleBooking && bookingForm.bookingDate && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Datum & tid</p>
          <p className="font-medium">
            {new Date(bookingForm.bookingDate).toLocaleDateString("sv-SE", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            kl. {bookingForm.startTime}
          </p>
        </div>
      )}
      {isFlexibleBooking && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Period</p>
          <p className="font-medium">{flexibleForm.dateFrom} - {flexibleForm.dateTo}</p>
          <p className="text-sm text-gray-600">
            {flexibleForm.priority === "urgent" ? "Akut" : "Normal"} prioritet, {flexibleForm.numberOfHorses} häst{flexibleForm.numberOfHorses !== 1 ? "ar" : ""}
          </p>
        </div>
      )}
      {!isFlexibleBooking && (bookingForm.horseName || bookingForm.horseId) && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Häst</p>
          <p className="font-medium">
            {bookingForm.horseId
              ? customerHorses.find(h => h.id === bookingForm.horseId)?.name || bookingForm.horseName
              : bookingForm.horseName}
          </p>
        </div>
      )}
      {isRecurring && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Återkommande</p>
          <p className="font-medium">
            Var {intervalWeeks}:e vecka, {totalOccurrences} tillfällen
          </p>
        </div>
      )}
      {!isFlexibleBooking && bookingForm.customerNotes && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Kommentarer</p>
          <p className="text-sm">{bookingForm.customerNotes}</p>
        </div>
      )}
    </div>
  )
}
