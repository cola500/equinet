"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek, format } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { CalendarHeader, ViewMode } from "@/components/calendar/CalendarHeader"
import { WeekCalendar } from "@/components/calendar/WeekCalendar"
import { BookingDetailDialog } from "@/components/calendar/BookingDetailDialog"
import { AvailabilityEditDialog } from "@/components/calendar/AvailabilityEditDialog"
import { DayExceptionDialog } from "@/components/calendar/DayExceptionDialog"
import { ManualBookingDialog } from "@/components/calendar/ManualBookingDialog"
import { CalendarBooking, AvailabilityDay, AvailabilityException } from "@/types"

// Detektera om vi är på mobil (client-side)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return isMobile
}

export default function ProviderCalendarPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const isMobile = useIsMobile()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null)
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([])
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [manualBookingOpen, setManualBookingOpen] = useState(false)
  const [services, setServices] = useState<{ id: string; name: string; price: number; durationMinutes: number }[]>([])

  // Sätt dagvy som default på mobil
  useEffect(() => {
    if (isMobile) {
      setViewMode("day")
    }
  }, [isMobile])

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  // Hämta provider-profil för att få provider-ID
  const fetchProviderProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/provider/profile")
      if (response.ok) {
        const data = await response.json()
        setProviderId(data.id)
      }
    } catch (error) {
      console.error("Error fetching provider profile:", error)
    }
  }, [])

  // Hämta öppettider
  const fetchAvailability = useCallback(async () => {
    if (!providerId) return

    try {
      const response = await fetch(`/api/providers/${providerId}/availability-schedule`)
      if (response.ok) {
        const data = await response.json()
        // Skapa komplett schema för alla 7 dagar
        const completeSchedule = Array.from({ length: 7 }, (_, dayOfWeek) => {
          const existing = data.find((item: AvailabilityDay) => item.dayOfWeek === dayOfWeek)
          if (existing) {
            return {
              dayOfWeek: existing.dayOfWeek,
              startTime: existing.startTime,
              endTime: existing.endTime,
              isClosed: existing.isClosed,
            }
          }
          // Default för dagar som saknas
          return {
            dayOfWeek,
            startTime: "09:00",
            endTime: "17:00",
            isClosed: false,
          }
        })
        setAvailability(completeSchedule)
      }
    } catch (error) {
      console.error("Error fetching availability:", error)
    }
  }, [providerId])

  // Hämta undantag för aktuell vecka
  const fetchExceptions = useCallback(async () => {
    if (!providerId) return

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })

    try {
      const from = format(weekStart, "yyyy-MM-dd")
      const to = format(weekEnd, "yyyy-MM-dd")
      const response = await fetch(
        `/api/providers/${providerId}/availability-exceptions?from=${from}&to=${to}`
      )
      if (response.ok) {
        const data = await response.json()
        setExceptions(data)
      }
    } catch (error) {
      console.error("Error fetching exceptions:", error)
    }
  }, [providerId, currentDate])

  // Hämta leverantörens tjänster (för manuell bokning)
  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/services")
      if (response.ok) {
        const data = await response.json()
        setServices(data.filter((s: { isActive: boolean }) => s.isActive))
      }
    } catch (error) {
      console.error("Error fetching services:", error)
    }
  }, [])

  const fetchBookings = useCallback(async () => {
    try {
      const response = await fetch("/api/bookings")
      if (response.ok) {
        const data = await response.json()
        setBookings(data)
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
      toast.error("Kunde inte hämta bokningar")
    }
  }, [])

  useEffect(() => {
    if (isProvider) {
      fetchProviderProfile()
      fetchBookings()
      fetchServices()
    }
  }, [isProvider, fetchProviderProfile, fetchBookings, fetchServices])

  useEffect(() => {
    if (providerId) {
      fetchAvailability()
      fetchExceptions()
    }
  }, [providerId, fetchAvailability, fetchExceptions])

  const handlePrevious = () => {
    if (viewMode === "day") {
      setCurrentDate((prev) => subDays(prev, 1))
    } else if (viewMode === "3-day") {
      setCurrentDate((prev) => subDays(prev, 3))
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1))
    }
  }

  const handleNext = () => {
    if (viewMode === "day") {
      setCurrentDate((prev) => addDays(prev, 1))
    } else if (viewMode === "3-day") {
      setCurrentDate((prev) => addDays(prev, 3))
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
  }

  const handleBookingClick = (booking: CalendarBooking) => {
    setSelectedBooking(booking)
    setDialogOpen(true)
  }

  const handleDayClick = (dayOfWeek: number) => {
    setSelectedDayOfWeek(dayOfWeek)
    setAvailabilityDialogOpen(true)
  }

  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    setExceptionDialogOpen(true)
  }

  const handleExceptionSave = async (data: {
    date: string
    isClosed: boolean
    startTime?: string | null
    endTime?: string | null
    reason?: string | null
    location?: string | null
    latitude?: number | null
    longitude?: number | null
  }) => {
    if (!providerId) return

    const response = await fetch(`/api/providers/${providerId}/availability-exceptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (response.ok) {
      toast.success("Undantag sparat!")
      fetchExceptions()
    } else {
      const errorData = await response.json()
      toast.error(errorData.error || "Kunde inte spara undantag")
      throw new Error("Failed to save exception")
    }
  }

  const handleExceptionDelete = async (date: string) => {
    if (!providerId) return

    const response = await fetch(
      `/api/providers/${providerId}/availability-exceptions/${date}`,
      { method: "DELETE" }
    )

    if (response.ok) {
      toast.success("Undantag borttaget!")
      fetchExceptions()
    } else {
      toast.error("Kunde inte ta bort undantag")
      throw new Error("Failed to delete exception")
    }
  }

  const handleAvailabilitySave = async (updatedDay: AvailabilityDay) => {
    if (!providerId) return

    // Uppdatera lokal state
    const updatedAvailability = availability.map((day) =>
      day.dayOfWeek === updatedDay.dayOfWeek ? updatedDay : day
    )

    try {
      const response = await fetch(`/api/providers/${providerId}/availability-schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schedule: updatedAvailability }),
      })

      if (response.ok) {
        setAvailability(updatedAvailability)
        toast.success("Öppettider uppdaterade!")
        setAvailabilityDialogOpen(false)
      } else {
        toast.error("Kunde inte spara öppettider")
      }
    } catch (error) {
      console.error("Error saving availability:", error)
      toast.error("Kunde inte spara öppettider")
    }
  }

  const handleStatusUpdate = async (bookingId: string, status: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error("Failed to update booking")
      }

      toast.success("Bokning uppdaterad!")
      setDialogOpen(false)
      fetchBookings()
    } catch (error) {
      console.error("Error updating booking:", error)
      toast.error("Kunde inte uppdatera bokning")
    }
  }

  // Filtrera bokningar för aktuell vecka
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })

  const weekBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.bookingDate)
    return bookingDate >= weekStart && bookingDate <= weekEnd
  })

  if (isLoading || !isProvider) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-6 md:mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Kalender</h1>
          <p className="text-gray-600 mt-1">Överblick av dina bokningar</p>
        </div>
        <button
          onClick={() => setManualBookingOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
        >
          + Bokning
        </button>
      </div>

      {/* Färgförklaring - kollapsad på mobil */}
      <details className="mb-4 md:hidden">
        <summary className="text-sm font-medium text-gray-700 cursor-pointer">
          Visa färgförklaring
        </summary>
        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400 border-l-2 border-yellow-500" />
            <span>Väntar</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-400 border-l-2 border-green-500" />
            <span>Bekräftad</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-400 border-l-2 border-blue-500" />
            <span>Genomförd</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500 border-l-2 border-emerald-600" />
            <span>Betald</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-200 border border-orange-300" />
            <span>Undantag</span>
          </div>
        </div>
      </details>
      <div className="hidden md:flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-400 border-l-4 border-yellow-500" />
          <span>Väntar på svar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-400 border-l-4 border-green-500" />
          <span>Bekräftad</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-400 border-l-4 border-blue-500" />
          <span>Genomförd</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-400 border-l-4 border-red-500" />
          <span>Avbokad</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500 border-l-4 border-emerald-600" />
          <span>Betald</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
          <span>Öppet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
          <span>Stängt (veckoschema)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-200 border border-orange-300" />
          <span>Ledig/undantag</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Klicka på en dag för att lägga till undantag (ledighet, semester, etc.)
      </p>

      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />

      <WeekCalendar
        currentDate={currentDate}
        bookings={weekBookings}
        availability={availability}
        exceptions={exceptions}
        viewMode={viewMode}
        onBookingClick={handleBookingClick}
        onDayClick={handleDayClick}
        onDateClick={handleDateClick}
      />

      <BookingDetailDialog
        booking={selectedBooking}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onStatusUpdate={handleStatusUpdate}
      />

      <AvailabilityEditDialog
        availability={selectedDayOfWeek !== null ? availability[selectedDayOfWeek] : null}
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
        onSave={handleAvailabilitySave}
      />

      <DayExceptionDialog
        date={selectedDate}
        exception={exceptions.find((e) => e.date === selectedDate) || null}
        open={exceptionDialogOpen}
        onOpenChange={setExceptionDialogOpen}
        onSave={handleExceptionSave}
        onDelete={handleExceptionDelete}
      />

      <ManualBookingDialog
        open={manualBookingOpen}
        onOpenChange={setManualBookingOpen}
        services={services}
        bookings={bookings}
        onBookingCreated={fetchBookings}
      />
    </ProviderLayout>
  )
}
