"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"
import { ServiceTimeStep } from "./ServiceTimeStep"
import { CustomerStep } from "./CustomerStep"
import { RecurringStep } from "./RecurringStep"
import type { CalendarBooking } from "@/types"

interface Service {
  id: string
  name: string
  price: number
  durationMinutes: number
}

interface CustomerResult {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

interface HorseResult {
  id: string
  name: string
  breed?: string
  birthYear?: number
  gender?: string
}

interface ManualBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  services: Service[]
  bookings?: CalendarBooking[]
  onBookingCreated: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutateBookings?: (...args: any[]) => any
  prefillDate?: string   // YYYY-MM-DD
  prefillTime?: string   // HH:mm
}

export function ManualBookingDialog({
  open,
  onOpenChange,
  services,
  bookings,
  onBookingCreated,
  mutateBookings,
  prefillDate,
  prefillTime,
}: ManualBookingDialogProps) {
  // Form state
  const [serviceId, setServiceId] = useState("")
  const [bookingDate, setBookingDate] = useState(
    () => prefillDate || new Date().toISOString().slice(0, 10)
  )
  const [startTime, setStartTime] = useState(() => prefillTime || "")
  const [endTime, setEndTime] = useState("")

  // Customer state
  const [customerMode, setCustomerMode] = useState<"search" | "manual">("search")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  // Horse state
  const [horses, setHorses] = useState<HorseResult[]>([])
  const [selectedHorseId, setSelectedHorseId] = useState("")
  const [horseName, setHorseName] = useState("")
  const [horseInfo, setHorseInfo] = useState("")

  // Other
  const [customerNotes, setCustomerNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const { isOnline, guardMutation } = useOfflineGuard()
  const isOfflineEnabled = useFeatureFlag("offline_mode")

  // Recurring booking state
  const [isRecurring, setIsRecurring] = useState(false)
  const [intervalWeeks, setIntervalWeeks] = useState(4)
  const [totalOccurrences, setTotalOccurrences] = useState(4)

  // Auto-calculate end time from service duration
  useEffect(() => {
    if (serviceId && startTime) {
      const service = services.find((s) => s.id === serviceId)
      if (service) {
        const [hours, minutes] = startTime.split(":").map(Number)
        const totalMinutes = hours * 60 + minutes + service.durationMinutes
        const endHours = Math.floor(totalMinutes / 60)
        const endMins = totalMinutes % 60
        setEndTime(
          `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`
        )
      }
    }
  }, [serviceId, startTime, services])

  // Search customers (debounced)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `/api/customers/search?q=${encodeURIComponent(searchQuery)}`
        )
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data)
        }
      } catch {
        // Silently handle search errors
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch horses when customer is selected
  const fetchHorses = useCallback(async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/horses`)
      if (response.ok) {
        const data = await response.json()
        setHorses(data)
      }
    } catch {
      // Silently handle - horse dropdown will just be empty
    }
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      fetchHorses(selectedCustomer.id)
    } else {
      setHorses([])
    }
  }, [selectedCustomer, fetchHorses])

  // Auto-switch to manual customer mode when offline
  useEffect(() => {
    if (!isOnline && customerMode === "search") {
      setCustomerMode("manual")
      setSelectedCustomer(null)
      setSearchQuery("")
    }
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync prefill values when dialog opens, reset form when it closes
  useEffect(() => {
    if (open) {
      setBookingDate(prefillDate || new Date().toISOString().slice(0, 10))
      setStartTime(prefillTime || "")
    } else {
      setServiceId("")
      setBookingDate(prefillDate || new Date().toISOString().slice(0, 10))
      setStartTime(prefillTime || "")
      setEndTime("")
      setCustomerMode("search")
      setSearchQuery("")
      setSearchResults([])
      setSelectedCustomer(null)
      setCustomerName("")
      setCustomerPhone("")
      setCustomerEmail("")
      setHorses([])
      setSelectedHorseId("")
      setHorseName("")
      setHorseInfo("")
      setCustomerNotes("")
      setIsRecurring(false)
      setIntervalWeeks(4)
      setTotalOccurrences(4)
    }
  }, [open, prefillDate, prefillTime])

  const handleSelectCustomer = (customer: CustomerResult) => {
    setSelectedCustomer(customer)
    setSearchQuery("")
    setSearchResults([])
  }

  const handleSubmit = async () => {
    if (!serviceId || !bookingDate || !startTime) {
      toast.error("Fyll i tjänst, datum och starttid")
      return
    }

    if (customerMode === "search" && !selectedCustomer) {
      toast.error("Välj en kund eller byt till manuell inmatning")
      return
    }

    if (customerMode === "manual" && !customerName.trim()) {
      toast.error("Ange kundens namn")
      return
    }

    if (customerMode === "manual" && customerPhone.trim()) {
      if (!/^(\+46|0)\d[\d\s-]{5,15}$/.test(customerPhone.trim())) {
        toast.error("Ogiltigt telefonnummer. Använd format: 0701234567 eller +46701234567")
        return
      }
    }

    if (customerMode === "manual" && customerEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
        toast.error("Ogiltig emailadress")
        return
      }
    }

    // Block recurring bookings offline
    if (isRecurring && !isOnline) {
      toast.error("Återkommande bokningar kräver internetanslutning")
      return
    }

    setIsSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        serviceId,
        bookingDate,
        startTime,
        endTime: endTime || undefined,
        customerNotes: customerNotes || undefined,
      }

      if (selectedCustomer) {
        body.customerId = selectedCustomer.id
      } else {
        body.customerName = customerName.trim()
        if (customerPhone) body.customerPhone = customerPhone.trim()
        if (customerEmail) body.customerEmail = customerEmail.trim()
      }

      if (selectedHorseId) {
        body.horseId = selectedHorseId
      } else if (horseName) {
        body.horseName = horseName
      }
      if (horseInfo) body.horseInfo = horseInfo

      if (isRecurring) {
        // Recurring booking - create series via booking-series endpoint
        const seriesBody: Record<string, unknown> = {
          providerId: "self", // Signal that provider is creating for themselves
          serviceId,
          firstBookingDate: bookingDate,
          startTime,
          intervalWeeks,
          totalOccurrences,
        }
        if (selectedCustomer) {
          seriesBody.customerId = selectedCustomer.id
        }
        if (selectedHorseId) seriesBody.horseId = selectedHorseId
        else if (horseName) seriesBody.horseName = horseName
        if (horseInfo) seriesBody.horseInfo = horseInfo
        if (customerNotes) seriesBody.customerNotes = customerNotes

        const response = await fetch("/api/booking-series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(seriesBody),
        })

        if (!response.ok) {
          const data = await response.json()
          toast.error(data.error || "Kunde inte skapa återkommande bokning")
          return
        }

        const data = await response.json()
        const skipped = data.skippedDates?.length || 0
        toast.success(
          `Återkommande bokning skapad! ${data.series.createdCount} av ${data.series.totalOccurrences} bokningar.` +
          (skipped > 0 ? ` ${skipped} datum hoppades över.` : "")
        )
        onOpenChange(false)
        onBookingCreated()
      } else {
        const bodyStr = JSON.stringify(body)
        const tempId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
        const selectedService = services.find((s) => s.id === serviceId)

        await guardMutation(async () => {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 10_000)
          const response = await fetch("/api/bookings/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyStr,
            signal: controller.signal,
          })
          clearTimeout(timeout)

          if (!response.ok) {
            const data = await response.json()
            if (data.details && Array.isArray(data.details)) {
              const firstIssue = data.details[0]
              toast.error(firstIssue.message || data.error || "Kunde inte skapa bokning")
            } else {
              toast.error(data.error || "Kunde inte skapa bokning")
            }
            return
          }

          toast.success("Bokning skapad!")
          onOpenChange(false)
          onBookingCreated()
        }, {
          method: "POST",
          url: "/api/bookings/manual",
          body: bodyStr,
          entityType: "manual-booking",
          entityId: tempId,
          optimisticUpdate: () => {
            // Add optimistic booking to SWR cache
            if (mutateBookings) {
              const optimisticBooking = {
                id: tempId,
                bookingDate,
                startTime,
                endTime: endTime || startTime,
                status: "confirmed",
                isManualBooking: true,
                _isOfflinePending: true,
                service: {
                  name: selectedService?.name || "Tjänst",
                  price: selectedService?.price || 0,
                },
                customer: {
                  firstName: selectedCustomer?.firstName || customerName.trim().split(" ")[0] || "Kund",
                  lastName: selectedCustomer?.lastName || customerName.trim().split(" ").slice(1).join(" ") || "",
                  email: selectedCustomer?.email || customerEmail || "",
                  phone: selectedCustomer?.phone || customerPhone || "",
                },
                horseName: horseName || undefined,
                customerNotes: customerNotes || undefined,
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mutateBookings(
                ((current: CalendarBooking[] | undefined) => [
                  ...(current || []),
                  optimisticBooking as CalendarBooking,
                ]) as any,
                { revalidate: false }
              )
            }
            onOpenChange(false)
          },
        })
      }
    } catch {
      toast.error("Kunde inte skapa bokning")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Ny manuell bokning</DialogTitle>
        </DialogHeader>

        {/* Offline notice */}
        {!isOnline && isOfflineEnabled && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            Du är offline. Bokningen sparas lokalt och synkas automatiskt.
          </div>
        )}
        {!isOnline && !isOfflineEnabled && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            Du är offline. Bokningen kan inte skapas utan internetanslutning.
          </div>
        )}

        <div className="space-y-4">
          {/* -- Tjänst & Tid -- */}
          <ServiceTimeStep
            services={services}
            serviceId={serviceId}
            onServiceChange={setServiceId}
            bookingDate={bookingDate}
            onBookingDateChange={setBookingDate}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            bookings={bookings}
          />

          {/* -- Kund -- */}
          <CustomerStep
            customerMode={customerMode}
            onCustomerModeChange={setCustomerMode}
            isOnline={isOnline}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={handleSelectCustomer}
            onClearCustomer={() => setSelectedCustomer(null)}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerPhone={customerPhone}
            onCustomerPhoneChange={setCustomerPhone}
            customerEmail={customerEmail}
            onCustomerEmailChange={setCustomerEmail}
            onSwitchToSearch={() => {
              setCustomerMode("search")
              setCustomerName("")
              setCustomerPhone("")
              setCustomerEmail("")
              setHorses([])
              setSelectedHorseId("")
              setHorseName("")
            }}
            onSwitchToManual={() => {
              setCustomerMode("manual")
              setSelectedCustomer(null)
              setSearchQuery("")
              setHorses([])
              setSelectedHorseId("")
              setHorseName("")
            }}
          />

          {/* -- Häst -- */}
          <div className="space-y-2 border-t pt-3">
            <Label>Häst</Label>
            {horses.length > 0 && (
              <select
                value={selectedHorseId}
                onChange={(e) => {
                  setSelectedHorseId(e.target.value)
                  if (e.target.value) {
                    const horse = horses.find((h) => h.id === e.target.value)
                    if (horse) setHorseName(horse.name)
                  }
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Välj häst eller skriv in...</option>
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.breed ? ` (${h.breed})` : ""}
                  </option>
                ))}
              </select>
            )}
            {!selectedHorseId && (
              <Input
                placeholder="Hästens namn"
                value={horseName}
                onChange={(e) => setHorseName(e.target.value)}
              />
            )}
            <Input
              placeholder="Info om hästen (valfritt)"
              value={horseInfo}
              onChange={(e) => setHorseInfo(e.target.value)}
            />
          </div>

          {/* -- Anteckningar -- */}
          <div className="border-t pt-3">
            <Label htmlFor="notes">Anteckningar</Label>
            <Input
              id="notes"
              placeholder="Valfria anteckningar..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* -- Recurring -- */}
          <RecurringStep
            isOnline={isOnline}
            isRecurring={isRecurring}
            onIsRecurringChange={setIsRecurring}
            intervalWeeks={intervalWeeks}
            onIntervalWeeksChange={setIntervalWeeks}
            totalOccurrences={totalOccurrences}
            onTotalOccurrencesChange={setTotalOccurrences}
          />

          {/* -- Submit -- */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Skapar..." : "Skapa bokning"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Avbryt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
