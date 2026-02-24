"use client"

import { createContext, useContext } from "react"
import type {
  BookingStep,
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

export interface BookingFlowContextValue {
  // From useBookingFlow -- state
  isOpen: boolean
  selectedService: SelectedService | null
  isFlexibleBooking: boolean
  step: BookingStep
  bookingForm: BookingFormState
  flexibleForm: FlexibleFormState
  canSubmit: boolean
  isRecurring: boolean
  intervalWeeks: number
  totalOccurrences: number

  // Setters from useBookingFlow
  setIsFlexibleBooking: (v: boolean) => void
  setStep: (step: BookingStep) => void
  setBookingForm: (fn: BookingFormState | ((prev: BookingFormState) => BookingFormState)) => void
  setFlexibleForm: (fn: FlexibleFormState | ((prev: FlexibleFormState) => FlexibleFormState)) => void
  setIsRecurring: (v: boolean) => void
  setIntervalWeeks: (v: number) => void
  setTotalOccurrences: (v: number) => void

  // Actions
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
  onSubmit: (e?: React.FormEvent) => void
  onOpenChange: (open: boolean) => void

  // Extra context (not from hook, passed by parent)
  customerHorses: CustomerHorse[]
  providerId: string
  customerLocation?: { latitude: number; longitude: number }
  nearbyRoute: NearbyRoute | null
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null)

export function BookingFlowProvider({
  value,
  children,
}: {
  value: BookingFlowContextValue
  children: React.ReactNode
}) {
  return (
    <BookingFlowContext.Provider value={value}>
      {children}
    </BookingFlowContext.Provider>
  )
}

export function useBookingFlowContext() {
  const ctx = useContext(BookingFlowContext)
  if (!ctx) {
    throw new Error("useBookingFlowContext must be used within BookingFlowProvider")
  }
  return ctx
}
