"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { toast } from "sonner"
import { Mic, MicOff, Send, Loader2, Check, X, Pencil } from "lucide-react"

type Step = "record" | "interpret" | "preview" | "saving" | "done"

interface InterpretedData {
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

interface VoiceWorkLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after successful save */
  onSuccess?: () => void
}

export function VoiceWorkLogDialog({
  open,
  onOpenChange,
  onSuccess,
}: VoiceWorkLogDialogProps) {
  const {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
  } = useSpeechRecognition()

  const [step, setStep] = useState<Step>("record")
  const [interpreted, setInterpreted] = useState<InterpretedData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedWork, setEditedWork] = useState("")
  const [editedObservation, setEditedObservation] = useState("")

  const reset = useCallback(() => {
    clearTranscript()
    setStep("record")
    setInterpreted(null)
    setIsEditing(false)
    setEditedWork("")
    setEditedObservation("")
  }, [clearTranscript])

  const handleClose = useCallback(() => {
    if (isListening) stopListening()
    reset()
    onOpenChange(false)
  }, [isListening, stopListening, reset, onOpenChange])

  const handleInterpret = useCallback(async () => {
    if (!transcript.trim()) {
      toast.error("Ingen text att tolka. Spela in eller skriv först.")
      return
    }

    setStep("interpret")

    try {
      const response = await fetch("/api/voice-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Tolkningen misslyckades")
      }

      const data = await response.json()
      setInterpreted(data.interpretation)
      setEditedWork(data.interpretation.workPerformed || "")
      setEditedObservation(data.interpretation.horseObservation || "")
      setStep("preview")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte tolka röstinspelningen"
      )
      setStep("record")
    }
  }, [transcript])

  const handleConfirm = useCallback(async () => {
    if (!interpreted?.bookingId) {
      toast.error("Ingen bokning matchad. Korrigera och försök igen.")
      return
    }

    setStep("saving")

    try {
      const response = await fetch("/api/voice-log/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: interpreted.bookingId,
          markAsCompleted: interpreted.markAsCompleted,
          workPerformed: isEditing ? editedWork : interpreted.workPerformed,
          horseObservation: isEditing
            ? editedObservation || null
            : interpreted.horseObservation,
          horseNoteCategory: interpreted.horseNoteCategory,
          nextVisitWeeks: interpreted.nextVisitWeeks,
        }),
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

      setTimeout(() => {
        handleClose()
        onSuccess?.()
      }, 1500)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte spara"
      )
      setStep("preview")
    }
  }, [interpreted, isEditing, editedWork, editedObservation, handleClose, onSuccess])

  const toggleMic = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Röstloggning</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Berätta vad du har gjort — appen tolkar och sparar åt dig.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Record */}
          {(step === "record" || step === "interpret") && (
            <>
              {/* Mic button */}
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={toggleMic}
                  disabled={!isSupported || step === "interpret"}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200"
                      : "bg-green-600 text-white hover:bg-green-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={isListening ? "Stoppa inspelning" : "Starta inspelning"}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
                <p className="text-sm text-gray-500">
                  {!isSupported
                    ? "Röstinspelning stöds inte i denna webbläsare"
                    : isListening
                      ? "Lyssnar... Tryck för att stoppa"
                      : "Tryck för att börja prata"}
                </p>
              </div>

              {/* Transcript text area */}
              <div>
                <Label htmlFor="voice-transcript">Transkribering</Label>
                <Textarea
                  id="voice-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Här dyker texten upp medan du pratar, eller skriv direkt..."
                  rows={4}
                  className="mt-1"
                  disabled={step === "interpret"}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Du kan redigera texten innan du skickar den.
                </p>
              </div>

              {/* Loading indicator */}
              {step === "interpret" && (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Tolkar...</span>
                </div>
              )}
            </>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && interpreted && (
            <div className="space-y-3">
              {/* Match info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Matchad bokning</h4>
                  {interpreted.confidence >= 0.7 ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                      Hög säkerhet
                    </span>
                  ) : interpreted.confidence >= 0.4 ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                      Medel säkerhet
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                      Låg säkerhet
                    </span>
                  )}
                </div>
                {interpreted.bookingId ? (
                  <div className="text-sm space-y-1">
                    {interpreted.customerName && (
                      <p>
                        <span className="text-gray-500">Kund:</span>{" "}
                        {interpreted.customerName}
                      </p>
                    )}
                    {interpreted.horseName && (
                      <p>
                        <span className="text-gray-500">Häst:</span>{" "}
                        {interpreted.horseName}
                      </p>
                    )}
                    {interpreted.markAsCompleted && (
                      <p className="text-green-600 font-medium">
                        Markeras som genomförd
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-600">
                    Ingen bokning kunde matchas. Korrigera texten och försök igen.
                  </p>
                )}
              </div>

              {/* Work performed */}
              {(interpreted.workPerformed || isEditing) && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Utfört arbete</Label>
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Redigera
                      </Button>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedWork}
                      onChange={(e) => setEditedWork(e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm mt-1 p-2 bg-blue-50 rounded">
                      {interpreted.workPerformed}
                    </p>
                  )}
                </div>
              )}

              {/* Horse observation */}
              {(interpreted.horseObservation || isEditing) && (
                <div>
                  <Label>Hästnotering</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedObservation}
                      onChange={(e) => setEditedObservation(e.target.value)}
                      rows={2}
                      className="mt-1"
                      placeholder="Hälsoobservation..."
                    />
                  ) : (
                    <p className="text-sm mt-1 p-2 bg-amber-50 rounded">
                      {interpreted.horseObservation}
                      {interpreted.horseNoteCategory && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({interpreted.horseNoteCategory})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Next visit */}
              {interpreted.nextVisitWeeks && (
                <div className="text-sm p-2 bg-purple-50 rounded">
                  <span className="text-gray-500">Nästa besök:</span>{" "}
                  om {interpreted.nextVisitWeeks} veckor
                </div>
              )}
            </div>
          )}

          {/* Step 3: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-medium">Sparat!</p>
            </div>
          )}

          {/* Saving indicator */}
          {step === "saving" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              <p className="text-sm text-gray-500">Sparar...</p>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter>
          {step === "record" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Avbryt
              </Button>
              <Button
                onClick={handleInterpret}
                disabled={!transcript.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                Tolka
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("record"); setInterpreted(null) }}>
                Tillbaka
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!interpreted?.bookingId}
              >
                <Check className="w-4 h-4 mr-2" />
                Spara allt
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
