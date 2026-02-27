"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, addDays } from "date-fns"
import { toast } from "sonner"

export type BookingStep = "selectType" | "selectTime" | "selectHorse" | "confirm" | "submitting"

export interface BookingFormState {
  bookingDate: string
  startTime: string
  horseId: string
  horseName: string
  horseInfo: string
  customerNotes: string
}

export interface FlexibleFormState {
  dateFrom: string
  dateTo: string
  priority: string
  numberOfHorses: number
  contactPhone: string
  specialInstructions: string
}

export interface CustomerHorse {
  id: string
  name: string
  breed: string | null
  specialNeeds: string | null
}

export interface SelectedService {
  id: string
  name: string
  description?: string
  price: number
  durationMinutes: number
  recommendedIntervalWeeks?: number | null
}

export interface SeriesResult {
  seriesId: string
  serviceName: string
  createdCount: number
  totalOccurrences: number
  intervalWeeks: number
  firstBookingDate: string
  skippedDates: { date: string; reason: string }[]
}

export interface UseBookingFlowOptions {
  providerId: string
  providerAddress?: string
  providerCity?: string
  providerBusinessName?: string
}

export function useBookingFlow({
  providerId,
  providerAddress,
  providerCity,
  providerBusinessName,
}: UseBookingFlowOptions) {
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<SelectedService | null>(null)
  const [isFlexibleBooking, setIsFlexibleBooking] = useState(false)
  const [step, setStep] = useState<BookingStep>("selectType")

  // Recurring booking state
  const [isRecurring, setIsRecurring] = useState(false)
  const [intervalWeeks, setIntervalWeeks] = useState(4)
  const [totalOccurrences, setTotalOccurrences] = useState(4)
  const [seriesResult, setSeriesResult] = useState<SeriesResult | null>(null)
  const [showSeriesResult, setShowSeriesResult] = useState(false)

  const [bookingForm, setBookingForm] = useState<BookingFormState>({
    bookingDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    startTime: "09:00",
    horseId: "",
    horseName: "",
    horseInfo: "",
    customerNotes: "",
  })

  const [flexibleForm, setFlexibleForm] = useState<FlexibleFormState>({
    dateFrom: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    dateTo: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    priority: "normal",
    numberOfHorses: 1,
    contactPhone: "",
    specialInstructions: "",
  })

  const openBooking = (service: SelectedService) => {
    setSelectedService(service)
    setBookingForm({
      bookingDate: "",
      startTime: "",
      horseId: "",
      horseName: "",
      horseInfo: "",
      customerNotes: "",
    })
    setIsFlexibleBooking(false)
    setIsRecurring(false)
    setIntervalWeeks(service.recommendedIntervalWeeks || 4)
    setTotalOccurrences(4)
    setStep("selectType")
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
  }

  const handleSlotSelect = (date: string, startTime: string, _endTime: string) => {
    setBookingForm((prev) => ({
      ...prev,
      bookingDate: date,
      startTime,
    }))
  }

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(":").map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`
  }

  const handleSubmitBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!selectedService) return

    if (!isFlexibleBooking && (!bookingForm.bookingDate || !bookingForm.startTime)) {
      toast.error("Du måste välja en tid i kalendern")
      return
    }

    setStep("submitting")

    try {
      if (isFlexibleBooking) {
        const response = await fetch("/api/route-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceType: selectedService.name,
            address:
              providerAddress ||
              `${providerBusinessName}, ${providerCity}`,
            latitude: 57.7089,
            longitude: 11.9746,
            numberOfHorses: flexibleForm.numberOfHorses,
            dateFrom: flexibleForm.dateFrom,
            dateTo: flexibleForm.dateTo,
            priority: flexibleForm.priority,
            specialInstructions: flexibleForm.specialInstructions,
            contactPhone: flexibleForm.contactPhone,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to create route order")
        }

        toast.success(
          "Flexibel bokning skapad! Leverantören planerar in dig i sin rutt."
        )
        setIsOpen(false)
        router.push("/customer/bookings")
      } else if (isRecurring) {
        // Recurring booking - create series
        const response = await fetch("/api/booking-series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            serviceId: selectedService.id,
            firstBookingDate: bookingForm.bookingDate,
            startTime: bookingForm.startTime,
            intervalWeeks,
            totalOccurrences,
            horseId: bookingForm.horseId || undefined,
            horseName: bookingForm.horseName || undefined,
            horseInfo: bookingForm.horseInfo || undefined,
            customerNotes: bookingForm.customerNotes || undefined,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Kunde inte skapa återkommande bokning")
        }

        setSeriesResult({
          seriesId: data.series.id,
          serviceName: selectedService.name,
          createdCount: data.series.createdCount,
          totalOccurrences: data.series.totalOccurrences,
          intervalWeeks: data.series.intervalWeeks,
          firstBookingDate: bookingForm.bookingDate,
          skippedDates: data.skippedDates || [],
        })
        setIsOpen(false)
        setShowSeriesResult(true)
      } else {
        const endTime = calculateEndTime(
          bookingForm.startTime,
          selectedService.durationMinutes
        )

        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId,
            serviceId: selectedService.id,
            bookingDate: bookingForm.bookingDate,
            startTime: bookingForm.startTime,
            endTime,
            horseId: bookingForm.horseId || undefined,
            horseName: bookingForm.horseName || undefined,
            horseInfo: bookingForm.horseInfo || undefined,
            customerNotes: bookingForm.customerNotes || undefined,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          if (response.status === 409) {
            toast.error(data.error || "Tiden är inte tillgänglig")
            setStep("selectTime")
            return
          }
          throw new Error(data.error || "Failed to create booking")
        }

        toast.success("Bokningsförfrågan skickad!")
        setIsOpen(false)
        router.push("/customer/bookings")
      }
    } catch (error: unknown) {
      console.error("Error creating booking:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa bokning")
      setStep("selectHorse")
    }
  }

  const canSubmit = isFlexibleBooking || (!!bookingForm.bookingDate && !!bookingForm.startTime)

  const closeSeriesResult = () => {
    setShowSeriesResult(false)
    setSeriesResult(null)
    router.push("/customer/bookings")
  }

  return {
    // State
    isOpen,
    selectedService,
    isFlexibleBooking,
    step,
    bookingForm,
    flexibleForm,
    canSubmit,

    // Recurring state
    isRecurring,
    intervalWeeks,
    totalOccurrences,
    seriesResult,
    showSeriesResult,

    // Setters
    setIsFlexibleBooking,
    setStep,
    setBookingForm,
    setFlexibleForm,
    setIsRecurring,
    setIntervalWeeks,
    setTotalOccurrences,

    // Actions
    openBooking,
    close,
    handleSlotSelect,
    handleSubmitBooking,
    closeSeriesResult,
  }
}
