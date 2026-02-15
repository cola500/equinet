"use client"

import { useState, useCallback } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { toast } from "sonner"

interface QuickNoteButtonProps {
  bookingId: string
  /** Callback after note is saved */
  onNoteSaved?: (cleanedText: string, actions: string[]) => void
  /** Button variant */
  variant?: "icon" | "inline"
}

export function QuickNoteButton({
  bookingId,
  onNoteSaved,
  variant = "icon",
}: QuickNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition()

  const handleMicClick = useCallback(() => {
    if (!isSupported) {
      // Fallback: show text input
      setIsOpen(true)
      return
    }

    if (isListening) {
      stopListening()
    } else {
      setIsOpen(true)
      startListening()
    }
  }, [isSupported, isListening, startListening, stopListening])

  const handleSave = useCallback(async () => {
    const text = transcript.trim()
    if (!text) return

    setIsSaving(true)
    try {
      const res = await fetch(
        `/api/provider/bookings/${bookingId}/quick-note`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kunde inte spara anteckningen")
      }

      const data = await res.json()

      const messages: string[] = ["Anteckning sparad"]
      if (data.actions?.includes("horseNote")) {
        messages.push("Hästnotering skapad")
      }

      if (data.suggestedNextWeeks) {
        toast.success(messages.join(" - "), {
          description: `Föreslår nästa besök om ${data.suggestedNextWeeks} veckor`,
        })
      } else {
        toast.success(messages.join(" - "))
      }

      onNoteSaved?.(data.cleanedText, data.actions)
      setTranscript("")
      setIsOpen(false)
      if (isListening) stopListening()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Kunde inte spara anteckningen"
      )
    } finally {
      setIsSaving(false)
    }
  }, [transcript, bookingId, onNoteSaved, toast, isListening, stopListening])

  const handleCancel = useCallback(() => {
    setTranscript("")
    setIsOpen(false)
    if (isListening) stopListening()
  }, [isListening, stopListening])

  // Compact mic button (not expanded)
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size={variant === "icon" ? "icon" : "sm"}
        onClick={handleMicClick}
        title="Snabbnotering"
        className={variant === "icon" ? "h-8 w-8" : ""}
      >
        <Mic className="h-4 w-4" />
        {variant === "inline" && (
          <span className="ml-1">Snabbnotering</span>
        )}
      </Button>
    )
  }

  // Expanded: text area + save/cancel
  return (
    <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-blue-900">
          Snabbnotering
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            if (isListening) {
              stopListening()
            } else if (isSupported) {
              startListening()
            }
          }}
        >
          {isListening ? (
            <MicOff className="h-4 w-4 text-red-500" />
          ) : (
            <Mic className="h-4 w-4 text-blue-600" />
          )}
        </Button>
      </div>
      {isListening && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Lyssnar...
        </div>
      )}
      <VoiceTextarea
        value={transcript}
        onChange={(value) => setTranscript(value)}
        placeholder={
          isSupported
            ? "Diktera eller skriv din anteckning..."
            : "Skriv din anteckning..."
        }
        rows={2}
        maxLength={2000}
      />
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Avbryt
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !transcript.trim()}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Sparar...
            </>
          ) : (
            "Spara"
          )}
        </Button>
      </div>
    </div>
  )
}
