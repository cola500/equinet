"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CustomerBookingCalendar } from "@/components/booking/CustomerBookingCalendar"
import { format } from "date-fns"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import type {
  BookingFormState,
  FlexibleFormState,
  CustomerHorse,
  SelectedService,
} from "@/hooks/useBookingFlow"

interface NearbyRoute {
  id: string
  dateFrom: string
  dateTo: string
}

interface DesktopBookingDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedService: SelectedService | null
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
  isRecurring: boolean
  setIsRecurring: (v: boolean) => void
  intervalWeeks: number
  setIntervalWeeks: (v: number) => void
  totalOccurrences: number
  setTotalOccurrences: (v: number) => void
}

export function DesktopBookingDialog({
  isOpen,
  onOpenChange,
  selectedService,
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
  isRecurring,
  setIsRecurring,
  intervalWeeks,
  setIntervalWeeks,
  totalOccurrences,
  setTotalOccurrences,
}: DesktopBookingDialogProps) {
  const recurringEnabled = useFeatureFlag("recurring_bookings")
  if (!selectedService) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Boka {selectedService.name}</DialogTitle>
          <DialogDescription>
            Fyll i dina uppgifter för att skicka en bokningsförfrågan
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="horse-select">Häst</Label>
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
                      <SelectTrigger id="horse-select">
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
                    id="horseName"
                    value={bookingForm.horseName}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, horseName: e.target.value })
                    }
                    placeholder="Hästens namn"
                  />
                )}
                {customerHorses.length > 0 && !bookingForm.horseId && (
                  <Input
                    id="horseName-manual"
                    value={bookingForm.horseName}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, horseName: e.target.value })
                    }
                    placeholder="Hästens namn"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerNotes">Övriga kommentarer</Label>
                <Textarea
                  id="customerNotes"
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

              {/* Recurring booking section */}
              {recurringEnabled && (
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="recurring-toggle" className="text-sm font-medium">
                        Gör detta återkommande
                      </Label>
                      <p className="text-xs text-gray-500">
                        Boka samma tid med regelbundna intervall
                      </p>
                    </div>
                    <Switch
                      id="recurring-toggle"
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                  </div>

                  {isRecurring && (
                    <div className="space-y-3 pl-1">
                      <div className="space-y-1">
                        <Label className="text-sm">Intervall</Label>
                        <Select
                          value={String(intervalWeeks)}
                          onValueChange={(v) => setIntervalWeeks(parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Varje vecka</SelectItem>
                            <SelectItem value="2">Varannan vecka</SelectItem>
                            <SelectItem value="4">Var 4:e vecka</SelectItem>
                            <SelectItem value="6">Var 6:e vecka</SelectItem>
                            <SelectItem value="8">Var 8:e vecka</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Antal tillfällen</Label>
                        <Select
                          value={String(totalOccurrences)}
                          onValueChange={(v) => setTotalOccurrences(parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2 tillfällen</SelectItem>
                            <SelectItem value="4">4 tillfällen</SelectItem>
                            <SelectItem value="6">6 tillfällen</SelectItem>
                            <SelectItem value="8">8 tillfällen</SelectItem>
                            <SelectItem value="12">12 tillfällen</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Flexible Booking Fields */}
          {isFlexibleBooking && (
            <div data-testid="flexible-booking-section">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Från datum *</Label>
                <Input
                  id="dateFrom"
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
                <Label htmlFor="dateTo">Till datum *</Label>
                <Input
                  id="dateTo"
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="priority-normal" data-testid="priority-normal" />
                    <Label htmlFor="priority-normal" className="font-normal cursor-pointer">
                      Normal - Inom den valda perioden
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="urgent" id="priority-urgent" data-testid="priority-urgent" />
                    <Label htmlFor="priority-urgent" className="font-normal cursor-pointer">
                      Akut - Inom 48 timmar
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numberOfHorses">Antal hästar *</Label>
                <Input
                  id="numberOfHorses"
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
                <Label htmlFor="contactPhone">Kontakttelefon *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={flexibleForm.contactPhone}
                  onChange={(e) =>
                    setFlexibleForm({ ...flexibleForm, contactPhone: e.target.value })
                  }
                  placeholder="070-123 45 67"
                  required
                />
                <p className="text-xs text-gray-600">
                  Leverantören kontaktar dig på detta nummer för att bekräfta tid
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialInstructions">Särskilda instruktioner</Label>
                <Textarea
                  id="specialInstructions"
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

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
            >
              Skicka bokningsförfrågan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
