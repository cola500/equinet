"use client"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer"
import { CustomerBookingCalendar } from "@/components/booking/CustomerBookingCalendar"
import { useBookingFlowContext } from "./BookingFlowContext"
import { HorseSelector } from "./HorseSelector"
import { RecurringSection } from "./RecurringSection"
import { FlexibleBookingForm } from "./FlexibleBookingForm"
import { BookingSummaryCard } from "./BookingSummaryCard"
import Link from "next/link"

export function MobileBookingFlow() {
  const {
    isOpen,
    onOpenChange,
    selectedService,
    step,
    setStep,
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

  if (!selectedService) return null

  const stepTitle = () => {
    switch (step) {
      case "selectType":
        return `Boka ${selectedService.name}`
      case "selectTime":
        return isFlexibleBooking ? "Välj datumspann" : "Välj tid"
      case "selectHorse":
        return "Häst & detaljer"
      case "confirm":
        return "Bekräfta bokning"
      case "submitting":
        return "Skickar..."
    }
  }

  const stepDescription = () => {
    switch (step) {
      case "selectType":
        return `${selectedService.price} kr - ${selectedService.durationMinutes} min`
      case "selectTime":
        return isFlexibleBooking
          ? "Välj en period när leverantören kan besöka dig"
          : "Välj datum och tid i kalendern"
      case "selectHorse":
        return "Fyll i resterande uppgifter"
      case "confirm":
        return "Kontrollera att allt stämmer"
      case "submitting":
        return "Vänta medan vi skickar din bokning..."
    }
  }

  const handleNext = () => {
    if (step === "selectType") {
      setStep("selectTime")
    } else if (step === "selectTime") {
      if (isFlexibleBooking) {
        setStep("confirm")
      } else {
        setStep("selectHorse")
      }
    } else if (step === "selectHorse") {
      setStep("confirm")
    }
  }

  const handleBack = () => {
    if (step === "selectTime") {
      setStep("selectType")
    } else if (step === "selectHorse") {
      setStep("selectTime")
    } else if (step === "confirm") {
      setStep(isFlexibleBooking ? "selectTime" : "selectHorse")
    }
  }

  const canGoNext = () => {
    if (step === "selectType") return true
    if (step === "selectTime") {
      if (isFlexibleBooking) return true
      return !!bookingForm.bookingDate && !!bookingForm.startTime
    }
    return false
  }

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{stepTitle()}</DrawerTitle>
          <DrawerDescription>{stepDescription()}</DrawerDescription>
          {/* Step indicator */}
          <div className="flex gap-1.5 mt-2">
            {["selectType", "selectTime", "selectHorse"].map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  ["selectType", "selectTime", "selectHorse"].indexOf(step) >= i
                    ? "bg-green-600"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto max-h-[60vh] px-4 pb-4" data-vaul-no-drag>
          {/* Step 1: Select booking type */}
          {step === "selectType" && (
            <div className="space-y-3">
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
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsFlexibleBooking(false)
                  handleNext()
                }}
                className="w-full p-4 rounded-lg border-2 border-blue-200 hover:border-blue-400 bg-white text-left transition-colors touch-target"
                data-testid="select-fixed-time"
              >
                <p className="font-semibold text-blue-800">Fast tid</p>
                <p className="text-sm text-gray-600 mt-1">
                  Välj exakt datum och tid i kalendern
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFlexibleBooking(true)
                  handleNext()
                }}
                className="w-full p-4 rounded-lg border-2 border-purple-200 hover:border-purple-400 bg-white text-left transition-colors touch-target"
                data-testid="select-flexible-time"
              >
                <p className="font-semibold text-purple-800">Flexibel tid</p>
                <p className="text-sm text-gray-600 mt-1">
                  Välj ett datumspann - leverantören planerar in dig
                </p>
              </button>
            </div>
          )}

          {/* Step 2: Select time */}
          {step === "selectTime" && !isFlexibleBooking && (
            <div className="space-y-3">
              <CustomerBookingCalendar
                providerId={providerId}
                serviceDurationMinutes={selectedService.durationMinutes}
                onSlotSelect={onSlotSelect}
                customerLocation={customerLocation}
              />
              {bookingForm.bookingDate && bookingForm.startTime && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
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
          )}

          {step === "selectTime" && isFlexibleBooking && (
            <FlexibleBookingForm idSuffix="-mobile" />
          )}

          {/* Step 3: Horse & details (fixed booking only) */}
          {step === "selectHorse" && !isFlexibleBooking && (
            <div className="space-y-4">
              {/* Summary of selected time */}
              {bookingForm.bookingDate && bookingForm.startTime && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <span className="font-semibold">Vald tid:</span>{" "}
                    {new Date(bookingForm.bookingDate).toLocaleDateString("sv-SE", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    kl. {bookingForm.startTime}
                  </p>
                </div>
              )}

              <HorseSelector idSuffix="-mobile" />
              <RecurringSection idSuffix="-mobile" />
            </div>
          )}

          {/* Confirm step */}
          {step === "confirm" && (
            <BookingSummaryCard />
          )}

          {/* Submitting state */}
          {step === "submitting" && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
          )}
        </div>

        <DrawerFooter>
          {step === "selectType" ? (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Avbryt
            </Button>
          ) : step === "selectTime" ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Tillbaka
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="flex-1"
              >
                Fortsätt
              </Button>
            </div>
          ) : step === "selectHorse" ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Tillbaka
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canSubmit}
                className="flex-1"
              >
                Granska bokning
              </Button>
            </div>
          ) : step === "confirm" ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Ändra
              </Button>
              <Button
                onClick={() => onSubmit()}
                className="flex-1"
              >
                Skicka bokningsförfrågan
              </Button>
            </div>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
