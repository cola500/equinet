"use client"

import { Suspense, useEffect, useState } from "react"
import { useDialogState } from "@/hooks/useDialogState"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { addWeeks, subWeeks, addDays, subDays, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { Mic } from "lucide-react"
import { toast } from "sonner"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"
import { useAuth } from "@/hooks/useAuth"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { useBookings as useSWRBookings } from "@/hooks/useBookings"
import { useServices } from "@/hooks/useServices"
import { useProviderProfile } from "@/hooks/useProviderProfile"
import { useAvailabilitySchedule } from "@/hooks/useAvailabilitySchedule"
import { useAvailabilityExceptions } from "@/hooks/useAvailabilityExceptions"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { CalendarHeader, ViewMode } from "@/components/calendar/CalendarHeader"
import { WeekCalendar } from "@/components/calendar/WeekCalendar"
import { MonthCalendar } from "@/components/calendar/MonthCalendar"
import { BookingDetailDialog } from "@/components/calendar/BookingDetailDialog"
import { AvailabilityEditDialog } from "@/components/calendar/AvailabilityEditDialog"
import { DayExceptionDialog } from "@/components/calendar/DayExceptionDialog"
import { ManualBookingDialog } from "@/components/calendar/ManualBookingDialog"
import { PendingBookingsBanner } from "@/components/calendar/PendingBookingsBanner"
import { CalendarBooking, AvailabilityDay, AvailabilityException } from "@/types"

export default function ProviderCalendarPage() {
  return (
    <Suspense>
      <CalendarContent />
    </Suspense>
  )
}

function CalendarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { isLoading, isProvider } = useAuth()
  const isMobile = useIsMobile()
  const { bookings: rawBookings, mutate: mutateBookings } = useSWRBookings()
  const bookings = rawBookings as unknown as CalendarBooking[]
  const { services: allServices } = useServices()
  const services = allServices.filter((s) => s.isActive)
  const { providerId } = useProviderProfile()
  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null)
  const bookingDialog = useDialogState()
  const { availability, mutate: mutateAvailability } = useAvailabilitySchedule(providerId)
  const availabilityDialog = useDialogState()
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null)
  const { exceptions, mutate: mutateExceptions } = useAvailabilityExceptions(providerId, currentDate)
  const exceptionDialog = useDialogState()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const manualBookingDialog = useDialogState()
  const [prefillDate, setPrefillDate] = useState<string | undefined>()
  const [prefillTime, setPrefillTime] = useState<string | undefined>()
  const isVoiceLoggingEnabled = useFeatureFlag("voice_logging")
  const { isOnline, guardMutation } = useOfflineGuard()

  // Sätt dagvy som default på mobil
  useEffect(() => {
    if (isMobile) {
      setViewMode("day")
    }
  }, [isMobile])

  // Återställ dialog vid tillbaka-navigation (URL -> state)
  const bookingIdFromUrl = searchParams.get('bookingId')
  useEffect(() => {
    if (bookingIdFromUrl && bookings?.length && !bookingDialog.open) {
      const booking = bookings.find(b => b.id === bookingIdFromUrl)
      if (booking) {
        setSelectedBooking(booking)
        bookingDialog.openDialog()
      }
    }
    if (!bookingIdFromUrl && bookingDialog.open) {
      bookingDialog.close()
      setSelectedBooking(null)
    }
  }, [bookingIdFromUrl, bookings]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => subMonths(prev, 1))
    } else if (viewMode === "day") {
      setCurrentDate((prev) => subDays(prev, 1))
    } else if (viewMode === "3-day") {
      setCurrentDate((prev) => subDays(prev, 3))
    } else {
      setCurrentDate((prev) => subWeeks(prev, 1))
    }
  }

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => addMonths(prev, 1))
    } else if (viewMode === "day") {
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
    bookingDialog.openDialog()
    // Skip URL update offline -- RSC request would fail and trigger error boundary
    if (isOnline) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('bookingId', booking.id)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }

  const handleDialogClose = (open: boolean) => {
    bookingDialog.setOpen(open)
    if (!open) {
      setSelectedBooking(null)
      // Skip URL update offline -- RSC request would fail and trigger error boundary
      if (isOnline) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('bookingId')
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
        router.replace(newUrl, { scroll: false })
      }
    }
  }

  const handleDayClick = (dayOfWeek: number) => {
    setSelectedDayOfWeek(dayOfWeek)
    availabilityDialog.openDialog()
  }

  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    exceptionDialog.openDialog()
  }

  const handleTimeSlotClick = (date: string, time: string) => {
    setPrefillDate(date)
    setPrefillTime(time)
    manualBookingDialog.openDialog()
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
    await guardMutation(async () => {
      if (!providerId) {
        toast.error("Kunde inte spara - profilen har inte laddats ännu. Försök igen.")
        throw new Error("Provider ID not available")
      }

      const response = await fetch(`/api/providers/${providerId}/availability-exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast.success("Undantag sparat!")
        mutateExceptions()
      } else {
        let errorMessage = "Kunde inte spara undantag"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // Non-JSON error response - use default message
        }
        toast.error(errorMessage)
        throw new Error("Failed to save exception")
      }
    })
  }

  const handleExceptionDelete = async (date: string) => {
    if (!providerId) return

    await guardMutation(async () => {
      const response = await fetch(
        `/api/providers/${providerId}/availability-exceptions/${date}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        toast.success("Undantag borttaget!")
        mutateExceptions()
      } else {
        toast.error("Kunde inte ta bort undantag")
        throw new Error("Failed to delete exception")
      }
    })
  }

  const handleAvailabilitySave = async (updatedDay: AvailabilityDay) => {
    if (!providerId) return

    await guardMutation(async () => {
      const updatedSchedule = availability.map((day) =>
        day.dayOfWeek === updatedDay.dayOfWeek ? updatedDay : day
      )

      try {
        const response = await fetch(`/api/providers/${providerId}/availability-schedule`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ schedule: updatedSchedule }),
        })

        if (response.ok) {
          mutateAvailability()
          toast.success("Öppettider uppdaterade!")
          availabilityDialog.close()
        } else {
          toast.error("Kunde inte spara öppettider")
        }
      } catch (error) {
        console.error("Error saving availability:", error)
        toast.error("Kunde inte spara öppettider")
      }
    })
  }

  const handleStatusUpdate = async (bookingId: string, status: string, cancellationMessage?: string) => {
    await guardMutation(async () => {
      try {
        const body: { status: string; cancellationMessage?: string } = { status }
        if (cancellationMessage) {
          body.cancellationMessage = cancellationMessage
        }

        const response = await fetch(`/api/bookings/${bookingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          throw new Error("Failed to update booking")
        }

        toast.success("Bokning uppdaterad!")
        handleDialogClose(false)
        mutateBookings()
      } catch (error) {
        console.error("Error updating booking:", error)
        toast.error("Kunde inte uppdatera bokning")
      }
    })
  }

  // Filtrera bokningar för aktuell period (vecka eller månad)
  const periodStart = viewMode === "month"
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 })
  const periodEnd = viewMode === "month"
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 })

  const periodBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.bookingDate)
    return bookingDate >= periodStart && bookingDate <= periodEnd
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
          onClick={() => manualBookingDialog.openDialog()}
          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
        >
          + Bokning
        </button>
      </div>

      <PendingBookingsBanner
        pendingBookings={pendingBookings}
        onBookingClick={handleBookingClick}
      />

      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />

      {viewMode === "month" ? (
        <MonthCalendar
          currentDate={currentDate}
          bookings={periodBookings}
          availability={availability}
          exceptions={exceptions}
          onBookingClick={handleBookingClick}
          onDateClick={handleDateClick}
          onTimeSlotClick={handleTimeSlotClick}
        />
      ) : (
        <WeekCalendar
          currentDate={currentDate}
          bookings={periodBookings}
          availability={availability}
          exceptions={exceptions}
          viewMode={viewMode}
          onBookingClick={handleBookingClick}
          onDayClick={handleDayClick}
          onDateClick={handleDateClick}
          onTimeSlotClick={handleTimeSlotClick}
        />
      )}

      {/* Färgförklaring - under kalendern */}
      <div className="mt-4">
        <p className="text-xs text-gray-500 mb-3">
          Klicka på en dag för att skapa bokning eller hantera tillgänglighet.
        </p>
        <div className="md:hidden overflow-x-auto pb-2">
          <div className="flex gap-3 text-xs whitespace-nowrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-50 border-l-2 border-yellow-500" />
              <span>Väntar</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-50 border-l-2 border-green-600" />
              <span>Bekräftad</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-50 border-l-2 border-blue-600" />
              <span>Genomförd</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-100 border-l-2 border-emerald-600" />
              <span>Betald</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-50 border-l-4 border-yellow-500" />
            <span>Väntar på svar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-50 border-l-4 border-green-600" />
            <span>Bekräftad</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-50 border-l-4 border-blue-600" />
            <span>Genomförd</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-50 border-l-4 border-red-500" />
            <span>Avbokad</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-100 border-l-4 border-emerald-600" />
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
      </div>

      {/* Mobile FAB for voice log */}
      {isVoiceLoggingEnabled && (
        <div className="fixed bottom-20 right-4 md:hidden z-40 flex flex-col items-center gap-1">
          <button
            onClick={() => router.push("/provider/voice-log")}
            className="h-14 w-14 rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors"
            aria-label="Logga utfört arbete"
          >
            <Mic className="w-6 h-6" />
          </button>
          <span className="text-xs font-medium text-gray-600">Logga arbete</span>
        </div>
      )}

      <BookingDetailDialog
        booking={selectedBooking}
        open={bookingDialog.open}
        onOpenChange={handleDialogClose}
        onStatusUpdate={handleStatusUpdate}
        onReviewSuccess={() => mutateBookings()}
        onNotesUpdate={(bookingId, notes) => {
          // Update selectedBooking immediately so dialog shows fresh notes
          // (SWR mutate is async and selectedBooking is a frozen snapshot)
          if (selectedBooking && selectedBooking.id === bookingId) {
            setSelectedBooking({ ...selectedBooking, providerNotes: notes })
          }
          mutateBookings()
        }}
      />

      <AvailabilityEditDialog
        availability={selectedDayOfWeek !== null ? availability[selectedDayOfWeek] : null}
        open={availabilityDialog.open}
        onOpenChange={availabilityDialog.setOpen}
        onSave={handleAvailabilitySave}
      />

      <DayExceptionDialog
        date={selectedDate}
        exception={exceptions.find((e) => e.date === selectedDate) || null}
        open={exceptionDialog.open}
        onOpenChange={exceptionDialog.setOpen}
        onSave={handleExceptionSave}
        onDelete={handleExceptionDelete}
      />

      <ManualBookingDialog
        open={manualBookingDialog.open}
        onOpenChange={(open) => {
          manualBookingDialog.setOpen(open)
          if (!open) { setPrefillDate(undefined); setPrefillTime(undefined) }
        }}
        services={services}
        bookings={bookings}
        onBookingCreated={() => mutateBookings()}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
      />
    </ProviderLayout>
  )
}
