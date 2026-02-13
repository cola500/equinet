"use client"

import { useState, useCallback } from "react"
import { useSpeechRecognition } from "./useSpeechRecognition"
import { toast } from "sonner"

export type VoiceLogStep = "record" | "interpret" | "preview" | "saving" | "done"

export interface BookingOption {
  id: string
  customerName: string
  horseName: string | null
  serviceName: string
  startTime: string
  status: string
}

export interface InterpretedData {
  bookingId: string | null
  customerName: string | null
  horseName: string | null
  markAsCompleted: boolean
  workPerformed: string | null
  horseObservation: string | null
  horseNoteCategory: string | null
  nextVisitWeeks: number | null
  confidence: number
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useVoiceWorkLog(options?: { onSuccess?: () => void }) {
  const speech = useSpeechRecognition()

  const [step, setStep] = useState<VoiceLogStep>("record")
  const [selectedDate, setSelectedDate] = useState<string>(todayString)
  const [interpreted, setInterpreted] = useState<InterpretedData | null>(null)
  const [availableBookings, setAvailableBookings] = useState<BookingOption[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editedWork, setEditedWork] = useState("")
  const [editedObservation, setEditedObservation] = useState("")

  // Track original AI output for vocabulary learning
  const [originalWorkPerformed, setOriginalWorkPerformed] = useState<string | null>(null)
  const [originalHorseObservation, setOriginalHorseObservation] = useState<string | null>(null)

  const reset = useCallback(() => {
    speech.clearTranscript()
    setStep("record")
    setSelectedDate(todayString())
    setInterpreted(null)
    setAvailableBookings([])
    setIsEditing(false)
    setEditedWork("")
    setEditedObservation("")
    setOriginalWorkPerformed(null)
    setOriginalHorseObservation(null)
  }, [speech])

  const handleInterpret = useCallback(async () => {
    if (!speech.transcript.trim()) {
      toast.error("Ingen text att tolka. Spela in eller skriv först.")
      return
    }

    setStep("interpret")

    try {
      const response = await fetch("/api/voice-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: speech.transcript.trim(), date: selectedDate }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Tolkningen misslyckades")
      }

      const data = await response.json()
      setInterpreted(data.interpretation)
      setAvailableBookings(data.bookings || [])
      setEditedWork(data.interpretation.workPerformed || "")
      setEditedObservation(data.interpretation.horseObservation || "")

      // Save original AI output for diff detection
      setOriginalWorkPerformed(data.interpretation.workPerformed || null)
      setOriginalHorseObservation(data.interpretation.horseObservation || null)

      setStep("preview")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte tolka röstinspelningen"
      )
      setStep("record")
    }
  }, [speech.transcript, selectedDate])

  const handleBookingChange = useCallback(
    (bookingId: string) => {
      if (!interpreted) return
      const booking = availableBookings.find((b) => b.id === bookingId)
      if (booking) {
        setInterpreted({
          ...interpreted,
          bookingId: booking.id,
          customerName: booking.customerName,
          horseName: booking.horseName,
        })
      }
    },
    [interpreted, availableBookings]
  )

  const handleConfirm = useCallback(async () => {
    if (!interpreted?.bookingId) {
      toast.error("Ingen bokning matchad. Välj en bokning och försök igen.")
      return
    }

    setStep("saving")

    const finalWork = isEditing ? editedWork : interpreted.workPerformed
    const finalObservation = isEditing
      ? editedObservation || null
      : interpreted.horseObservation

    try {
      const body: Record<string, unknown> = {
        bookingId: interpreted.bookingId,
        markAsCompleted: interpreted.markAsCompleted,
        workPerformed: finalWork,
        horseObservation: finalObservation,
        horseNoteCategory: interpreted.horseNoteCategory,
        nextVisitWeeks: interpreted.nextVisitWeeks,
      }

      // Include original data for vocabulary learning
      if (originalWorkPerformed && finalWork !== originalWorkPerformed) {
        body.originalWorkPerformed = originalWorkPerformed
      }
      if (originalHorseObservation && finalObservation !== originalHorseObservation) {
        body.originalHorseObservation = originalHorseObservation
      }

      const response = await fetch("/api/voice-log/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte spara")
      }

      const data = await response.json()
      setStep("done")
      toast.success("Arbetslogg sparad!")

      if (data.nextVisitWeeks) {
        toast.info(`Förslag: nästa besök om ${data.nextVisitWeeks} veckor`)
      }

      options?.onSuccess?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte spara"
      )
      setStep("preview")
    }
  }, [
    interpreted,
    isEditing,
    editedWork,
    editedObservation,
    originalWorkPerformed,
    originalHorseObservation,
    options,
  ])

  const handleLogNext = useCallback(() => {
    speech.clearTranscript()
    setStep("record")
    setInterpreted(null)
    setIsEditing(false)
    setEditedWork("")
    setEditedObservation("")
    setOriginalWorkPerformed(null)
    setOriginalHorseObservation(null)
    // Keep availableBookings -- same day's bookings
  }, [speech])

  const toggleMic = useCallback(() => {
    if (speech.isListening) {
      speech.stopListening()
    } else {
      speech.startListening()
    }
  }, [speech])

  return {
    // Speech
    transcript: speech.transcript,
    setTranscript: speech.setTranscript,
    isListening: speech.isListening,
    isSupported: speech.isSupported,
    toggleMic,

    // Wizard state
    step,
    selectedDate,
    setSelectedDate,
    interpreted,
    availableBookings,
    isEditing,
    editedWork,
    editedObservation,
    setIsEditing,
    setEditedWork,
    setEditedObservation,

    // Actions
    handleInterpret,
    handleBookingChange,
    handleConfirm,
    handleLogNext,
    reset,
  }
}
