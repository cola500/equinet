"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CustomerBookingCalendar } from "@/components/booking/CustomerBookingCalendar"
import { useBookingFlowContext } from "./BookingFlowContext"
import { HorseSelector } from "./HorseSelector"
import { RecurringSection } from "./RecurringSection"
import { FlexibleBookingForm } from "./FlexibleBookingForm"
import { BookingSummaryCard } from "./BookingSummaryCard"

export function DesktopBookingDialog() {
  const {
    isOpen,
    onOpenChange,
    selectedService,
    isFlexibleBooking,
    setIsFlexibleBooking,
    bookingForm,
    canSubmit,
    onSlotSelect,
    onSubmit,
    providerId,
    customerLocation,
    nearbyRoute,
  } = useBookingFlowContext()

  const [showSummary, setShowSummary] = useState(false)

  if (!selectedService) return null

  const handleOpenChange = (open: boolean) => {
    if (!open) setShowSummary(false)
    onOpenChange(open)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Boka {selectedService.name}</DialogTitle>
          <DialogDescription>
            {showSummary
              ? "Kontrollera dina uppgifter innan du skickar"
              : "Fyll i dina uppgifter för att skicka en bokningsförfrågan"}
          </DialogDescription>
        </DialogHeader>

        {/* Summary view */}
        {showSummary && (
          <div className="space-y-4">
            <BookingSummaryCard />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSummary(false)}
              >
                Ändra
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowSummary(false)
                  onSubmit()
                }}
              >
                Skicka bokningsförfrågan
              </Button>
            </div>
          </div>
        )}

        {/* Form view */}
        <form onSubmit={(e) => { e.preventDefault(); setShowSummary(true) }} className={`space-y-4 ${showSummary ? "hidden" : ""}`}>
          {/* Route Booking Option */}
          {nearbyRoute && (
            <div
              className="p-4 rounded-lg border-2 border-green-300 bg-green-50"
              data-testid="route-booking-option"
            >
              <h4 className="font-semibold text-green-800">
                Boka på planerad rutt
              </h4>
              <p className="text-sm text-green-700 mt-1">
                Leverantören kommer till ditt område{" "}
                {new Date(nearbyRoute.dateFrom).toLocaleDateString("sv-SE", {
                  day: "numeric",
                  month: "short",
                })}
                {nearbyRoute.dateFrom !== nearbyRoute.dateTo && (
                  <>
                    {" - "}
                    {new Date(nearbyRoute.dateTo).toLocaleDateString("sv-SE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </>
                )}
              </p>
              <Link href={`/announcements/${nearbyRoute.id}/book`}>
                <Button
                  type="button"
                  className="w-full mt-3 bg-green-600 hover:bg-green-700"
                >
                  Boka på rutten
                </Button>
              </Link>
              <p className="text-xs text-center text-gray-500 mt-2">
                Eller välj annan tid nedan
              </p>
            </div>
          )}

          {/* Booking Type Toggle */}
          <div className="p-4 rounded-lg border-2 border-blue-300 bg-gray-50 transition-all duration-300" data-testid="booking-type-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="booking-type" className="text-base font-medium cursor-pointer">
                  {isFlexibleBooking ? "Flexibel tid" : "Fast tid"}
                </Label>
                <div className="group relative">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Information om bokningstyper"
                  >
                    i
                  </button>
                  <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
                    <div className="mb-2">
                      <p className="font-semibold text-blue-700">Fast tid:</p>
                      <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                        <li>Du väljer exakt datum och tid</li>
                        <li>Direkt bekräftelse om tillgänglig</li>
                        <li>Passar när du har tight schema</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-purple-700">Flexibel tid:</p>
                      <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                        <li>Välj period (flera dagar)</li>
                        <li>Leverantören planerar optimal tid</li>
                        <li>Passar när du är flexibel</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <Switch
                id="booking-type"
                data-testid="booking-type-toggle"
                checked={isFlexibleBooking}
                onCheckedChange={setIsFlexibleBooking}
                className={`${
                  isFlexibleBooking
                    ? 'data-[state=checked]:bg-purple-700 shadow-md'
                    : 'data-[state=unchecked]:bg-blue-600 shadow-md'
                }`}
              />
            </div>
            <p className="text-sm text-gray-700">
              {isFlexibleBooking
                ? "Välj ett datumspann (t.ex. '1-5 januari') så planerar leverantören in dig i sin rutt"
                : "Du väljer exakt datum och tid (t.ex. 'Fredag 15 nov kl 14:00')"
              }
            </p>
          </div>

          {/* Fixed Time Booking Fields */}
          {!isFlexibleBooking && (
            <>
              <div className="space-y-2">
                <Label>Välj tid *</Label>
                <CustomerBookingCalendar
                  providerId={providerId}
                  serviceDurationMinutes={selectedService.durationMinutes}
                  onSlotSelect={onSlotSelect}
                  customerLocation={customerLocation}
                />
                {bookingForm.bookingDate && bookingForm.startTime && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      <span className="font-semibold">Vald tid:</span>{" "}
                      {new Date(bookingForm.bookingDate).toLocaleDateString("sv-SE", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      kl. {bookingForm.startTime}
                      <span className="text-gray-600 ml-1">
                        ({selectedService.durationMinutes} min)
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <HorseSelector />
              <RecurringSection />
            </>
          )}

          {/* Flexible Booking Fields */}
          {isFlexibleBooking && (
            <FlexibleBookingForm />
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
            >
              Granska bokning
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
