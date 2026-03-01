"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { Switch } from "@/components/ui/switch"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"
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

  // Recurring booking state
  const recurringEnabled = useFeatureFlag("recurring_bookings")
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

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
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

  // Bookings for the selected day (excluding cancelled)
  const dayBookings = useMemo(() => {
    if (!bookingDate || !bookings) return []
    return bookings
      .filter(b => b.bookingDate.startsWith(bookingDate))
      .filter(b => b.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [bookingDate, bookings])

  // Overlap warning
  const hasOverlap = useMemo(() => {
    if (!startTime || !endTime || !dayBookings.length) return false
    return dayBookings.some(b =>
      startTime < b.endTime && endTime > b.startTime
    )
  }, [startTime, endTime, dayBookings])

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
        const tempId = crypto.randomUUID()
        const selectedService = services.find((s) => s.id === serviceId)

        await guardMutation(async () => {
          const response = await fetch("/api/bookings/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyStr,
          })

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

        <div className="space-y-4">
          {/* -- Tjänst & Tid -- */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="service">Tjänst</Label>
              <select
                id="service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Välj tjänst...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min, {s.price} kr)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="date">Datum</Label>
                <input
                  id="date"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  onBlur={(e) => setBookingDate(e.target.value)}
                  className="mt-1 flex h-10 w-full max-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="start">Starttid</Label>
                <select
                  id="start"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Välj tid...</option>
                  {Array.from({ length: (21 - 6) * 4 }, (_, i) => {
                    const h = Math.floor(i / 4) + 6
                    const m = (i % 4) * 15
                    const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                    return <option key={val} value={val}>{val}</option>
                  })}
                </select>
                {endTime && (
                  <p className="text-xs text-gray-500 mt-1">Sluttid: {endTime}</p>
                )}
                {hasOverlap && (
                  <p className="text-xs text-red-600 mt-1">
                    Tiden krockar med en befintlig bokning
                  </p>
                )}
              </div>
            </div>

            {bookingDate && dayBookings.length > 0 && (
              <div className="rounded-md border bg-gray-50 p-2">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Bokningar denna dag
                </p>
                <div className="space-y-1">
                  {dayBookings.map(b => (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-gray-700">
                        {b.startTime}&#8209;{b.endTime}
                      </span>
                      <span className="text-gray-500 truncate">
                        {b.service.name} - {b.customer.firstName} {b.customer.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Offline notice */}
          {!isOnline && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              Du är offline. Bokningen sparas lokalt och synkas automatiskt.
            </div>
          )}

          {/* -- Kund -- */}
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>Kund</Label>
              <div className="flex gap-1">
                <Button
                  variant={customerMode === "search" ? "default" : "ghost"}
                  size="sm"
                  disabled={!isOnline}
                  onClick={() => {
                    setCustomerMode("search")
                    setCustomerName("")
                    setCustomerPhone("")
                    setCustomerEmail("")
                    setHorses([])
                    setSelectedHorseId("")
                    setHorseName("")
                  }}
                  className="h-7 text-xs"
                >
                  Befintlig
                </Button>
                <Button
                  variant={customerMode === "manual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setCustomerMode("manual")
                    setSelectedCustomer(null)
                    setSearchQuery("")
                    setHorses([])
                    setSelectedHorseId("")
                    setHorseName("")
                  }}
                  className="h-7 text-xs"
                >
                  Ny kund
                </Button>
              </div>
            </div>

            {customerMode === "search" ? (
              <div>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                    <span className="text-sm font-medium">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                      <span className="text-gray-500 ml-2">
                        {selectedCustomer.email}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCustomer(null)}
                      className="h-6 text-xs"
                    >
                      Byt
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Sök kund (namn eller email)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-3 text-xs text-gray-400">
                        Söker...
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {searchResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
                          >
                            <span className="font-medium">
                              {c.firstName} {c.lastName}
                            </span>
                            <span className="text-gray-500 ml-2">{c.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Namn *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Telefon"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

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
          {recurringEnabled && (
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="manual-recurring" className="text-sm font-medium">
                    Gör detta återkommande
                  </Label>
                  <p className="text-xs text-gray-500">
                    Skapa flera bokningar med regelbundna intervall
                  </p>
                </div>
                <Switch
                  id="manual-recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Intervall</Label>
                    <select
                      value={intervalWeeks}
                      onChange={(e) => setIntervalWeeks(parseInt(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mt-1"
                    >
                      <option value={1}>Varje vecka</option>
                      <option value={2}>Varannan vecka</option>
                      <option value={4}>Var 4:e vecka</option>
                      <option value={6}>Var 6:e vecka</option>
                      <option value={8}>Var 8:e vecka</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Antal tillfällen</Label>
                    <select
                      value={totalOccurrences}
                      onChange={(e) => setTotalOccurrences(parseInt(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mt-1"
                    >
                      <option value={2}>2</option>
                      <option value={4}>4</option>
                      <option value={6}>6</option>
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

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
