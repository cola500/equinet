"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { addWeeks, subWeeks, startOfWeek, endOfWeek } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { CalendarHeader } from "@/components/calendar/CalendarHeader"
import { WeekCalendar } from "@/components/calendar/WeekCalendar"
import { BookingDetailDialog } from "@/components/calendar/BookingDetailDialog"
import { AvailabilityEditDialog } from "@/components/calendar/AvailabilityEditDialog"
import { CalendarBooking, AvailabilityDay } from "@/types"

export default function ProviderCalendarPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [availability, setAvailability] = useState<AvailabilityDay[]>([])
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null)

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
    }
  }, [isProvider, fetchProviderProfile, fetchBookings])

  useEffect(() => {
    if (providerId) {
      fetchAvailability()
    }
  }, [providerId, fetchAvailability])

  const handlePreviousWeek = () => {
    setCurrentDate((prev) => subWeeks(prev, 1))
  }

  const handleNextWeek = () => {
    setCurrentDate((prev) => addWeeks(prev, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleBookingClick = (booking: CalendarBooking) => {
    setSelectedBooking(booking)
    setDialogOpen(true)
  }

  const handleDayClick = (dayOfWeek: number) => {
    setSelectedDayOfWeek(dayOfWeek)
    setAvailabilityDialogOpen(true)
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Kalender</h1>
        <p className="text-gray-600 mt-1">Överblick av dina bokningar</p>
      </div>

      {/* Färgförklaring */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
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
          <span>Stängt</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Klicka på en dags rubrik för att redigera öppettider
      </p>

      <CalendarHeader
        currentDate={currentDate}
        onPreviousWeek={handlePreviousWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
      />

      <WeekCalendar
        currentDate={currentDate}
        bookings={weekBookings}
        availability={availability}
        onBookingClick={handleBookingClick}
        onDayClick={handleDayClick}
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
    </ProviderLayout>
  )
}
