"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer"
import { CustomerBookingCalendar } from "@/components/booking/CustomerBookingCalendar"
import { format } from "date-fns"
import type {
  BookingStep,
  BookingFormState,
  FlexibleFormState,
  CustomerHorse,
  SelectedService,
} from "@/hooks/useBookingFlow"
import Link from "next/link"

interface NearbyRoute {
  id: string
  dateFrom: string
  dateTo: string
}

interface MobileBookingFlowProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedService: SelectedService | null
  step: BookingStep
  setStep: (step: BookingStep) => void
  isFlexibleBooking: boolean
  setIsFlexibleBooking: (v: boolean) => void
  bookingForm: BookingFormState
  setBookingForm: (fn: BookingFormState | ((prev: BookingFormState) => BookingFormState)) => void
  flexibleForm: FlexibleFormState
  setFlexibleForm: (fn: FlexibleFormState | ((prev: FlexibleFormState) => FlexibleFormState)) => void
  customerHorses: CustomerHorse[]
  providerId: string
  customerLocation?: { latitude: number; longitude: number }
  nearbyRoute: NearbyRoute | null
  canSubmit: boolean
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
  onSubmit: (e?: React.FormEvent) => void
}

export function MobileBookingFlow({
  isOpen,
  onOpenChange,
  selectedService,
  step,
  setStep,
  isFlexibleBooking,
  setIsFlexibleBooking,
  bookingForm,
  setBookingForm,
  flexibleForm,
  setFlexibleForm,
  customerHorses,
  providerId,
  customerLocation,
  nearbyRoute,
  canSubmit,
  onSlotSelect,
  onSubmit,
}: MobileBookingFlowProps) {
  if (!selectedService) return null

  const stepTitle = () => {
    switch (step) {
      case "selectType":
        return `Boka ${selectedService.name}`
      case "selectTime":
        return isFlexibleBooking ? "Välj datumspann" : "Välj tid"
      case "selectHorse":
        return "Häst & detaljer"
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
      case "submitting":
        return "Vänta medan vi skickar din bokning..."
    }
  }

  const handleNext = () => {
    if (step === "selectType") {
      setStep("selectTime")
    } else if (step === "selectTime") {
      setStep("selectHorse")
    }
  }

  const handleBack = () => {
    if (step === "selectTime") {
      setStep("selectType")
    } else if (step === "selectHorse") {
      setStep("selectTime")
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
            <div className="space-y-4" data-testid="flexible-booking-section">
              <div className="space-y-2">
                <Label htmlFor="dateFrom-mobile">Från datum *</Label>
                <Input
                  id="dateFrom-mobile"
                  type="date"
                  value={flexibleForm.dateFrom}
                  onChange={(e) =>
                    setFlexibleForm({ ...flexibleForm, dateFrom: e.target.value })
                  }
                  min={format(new Date(), "yyyy-MM-dd")}
                  required

                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo-mobile">Till datum *</Label>
                <Input
                  id="dateTo-mobile"
                  type="date"
                  value={flexibleForm.dateTo}
                  onChange={(e) =>
                    setFlexibleForm({ ...flexibleForm, dateTo: e.target.value })
                  }
                  min={flexibleForm.dateFrom}
                  required

                />
                <p className="text-xs text-gray-600">
                  Leverantören kan besöka dig när som helst under denna period
                </p>
              </div>
              <div className="space-y-2">
                <Label>Prioritet *</Label>
                <RadioGroup
                  value={flexibleForm.priority}
                  onValueChange={(value) =>
                    setFlexibleForm({ ...flexibleForm, priority: value })
                  }
                >
                  <div className="flex items-center space-x-2 touch-target">
                    <RadioGroupItem value="normal" id="priority-normal-mobile" data-testid="priority-normal" />
                    <Label htmlFor="priority-normal-mobile" className="font-normal cursor-pointer">
                      Normal - Inom den valda perioden
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 touch-target">
                    <RadioGroupItem value="urgent" id="priority-urgent-mobile" data-testid="priority-urgent" />
                    <Label htmlFor="priority-urgent-mobile" className="font-normal cursor-pointer">
                      Akut - Inom 48 timmar
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfHorses-mobile">Antal hästar *</Label>
                <Input
                  id="numberOfHorses-mobile"
                  type="number"
                  min="1"
                  value={flexibleForm.numberOfHorses}
                  onChange={(e) =>
                    setFlexibleForm({ ...flexibleForm, numberOfHorses: parseInt(e.target.value) || 1 })
                  }
                  required

                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone-mobile">Kontakttelefon *</Label>
                <Input
                  id="contactPhone-mobile"
                  type="tel"
                  value={flexibleForm.contactPhone}
                  onChange={(e) =>
                    setFlexibleForm({ ...flexibleForm, contactPhone: e.target.value })
                  }
                  placeholder="070-123 45 67"
                  required

                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialInstructions-mobile">Särskilda instruktioner</Label>
                <Textarea
                  id="specialInstructions-mobile"
                  value={flexibleForm.specialInstructions}
                  onChange={(e) =>
                    setFlexibleForm({ ...flexibleForm, specialInstructions: e.target.value })
                  }
                  rows={2}
                  placeholder="T.ex. portkod, parkering, hästens behov..."
                />
              </div>
            </div>
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

              <div className="space-y-2">
                <Label htmlFor="horse-select-mobile">Häst</Label>
                {customerHorses.length > 0 ? (
                  <>
                    <Select
                      value={bookingForm.horseId}
                      onValueChange={(value) => {
                        if (value === "__manual__") {
                          setBookingForm({
                            ...bookingForm,
                            horseId: "",
                            horseName: "",
                            horseInfo: "",
                          })
                        } else {
                          const horse = customerHorses.find((h) => h.id === value)
                          setBookingForm({
                            ...bookingForm,
                            horseId: value,
                            horseName: horse?.name || "",
                            horseInfo: horse?.specialNeeds || "",
                          })
                        }
                      }}
                    >
                      <SelectTrigger id="horse-select-mobile">
                        <SelectValue placeholder="Välj häst..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customerHorses.map((horse) => (
                          <SelectItem key={horse.id} value={horse.id}>
                            {horse.name}
                            {horse.breed && ` (${horse.breed})`}
                          </SelectItem>
                        ))}
                        <SelectItem value="__manual__">
                          Annan häst (ange manuellt)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {bookingForm.horseId && bookingForm.horseId !== "__manual__" && bookingForm.horseInfo && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        {bookingForm.horseInfo}
                      </p>
                    )}
                  </>
                ) : (
                  <Input
                    id="horseName-mobile"
                    value={bookingForm.horseName}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, horseName: e.target.value })
                    }
                    placeholder="Hästens namn"
  
                  />
                )}
                {customerHorses.length > 0 && !bookingForm.horseId && (
                  <Input
                    id="horseName-manual-mobile"
                    value={bookingForm.horseName}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, horseName: e.target.value })
                    }
                    placeholder="Hästens namn"
  
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerNotes-mobile">Övriga kommentarer</Label>
                <Textarea
                  id="customerNotes-mobile"
                  value={bookingForm.customerNotes}
                  onChange={(e) =>
                    setBookingForm({
                      ...bookingForm,
                      customerNotes: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>
            </div>
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
              {isFlexibleBooking ? (
                <Button
                  onClick={() => onSubmit()}
                  className="flex-1"
                >
                  Skicka förfrågan
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="flex-1"
                >
                  Fortsätt
                </Button>
              )}
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
                onClick={() => onSubmit()}
                disabled={!canSubmit}
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
