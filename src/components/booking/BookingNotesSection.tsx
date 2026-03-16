"use client"

import { useState } from "react"
import { PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { QuickNoteButton } from "@/components/booking/QuickNoteButton"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"
import { toast } from "sonner"

const ALLOWED_STATUSES = ["confirmed", "completed", "no_show"]
const MAX_LENGTH = 2000

interface BookingNotesSectionProps {
  bookingId: string
  providerNotes: string | null
  status: string
  onNotesUpdate: (providerNotes: string | null) => void
}

export function BookingNotesSection({
  bookingId,
  providerNotes,
  status,
  onNotesUpdate,
}: BookingNotesSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const { guardMutation } = useOfflineGuard()

  if (!ALLOWED_STATUSES.includes(status)) return null

  const handleStartEdit = (prefill: string) => {
    setEditText(prefill)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditText("")
  }

  const handleSave = async () => {
    const trimmed = editText.trim() || null
    const body = JSON.stringify({ providerNotes: trimmed })

    setIsSaving(true)
    try {
      await guardMutation(
        async () => {
          const res = await fetch(
            `/api/provider/bookings/${bookingId}/notes`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body,
            }
          )
          if (res.ok) {
            setIsEditing(false)
            onNotesUpdate(trimmed)
            toast.success("Anteckning sparad")
          } else {
            toast.error("Kunde inte spara anteckningen")
          }
        },
        {
          method: "PUT",
          url: `/api/provider/bookings/${bookingId}/notes`,
          body,
          entityType: "booking-notes",
          entityId: bookingId,
          optimisticUpdate: () => {
            setIsEditing(false)
            onNotesUpdate(trimmed)
          },
        }
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-gray-700">
          Dina anteckningar
        </h4>
        {!isEditing && (
          <QuickNoteButton
            bookingId={bookingId}
            variant="icon"
            onNoteSaved={(cleanedText) => {
              onNotesUpdate(cleanedText)
            }}
          />
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <VoiceTextarea
            value={editText}
            onChange={(value) => setEditText(value)}
            maxLength={MAX_LENGTH}
            placeholder="Skriv anteckningar om behandlingen..."
            rows={3}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {editText.length}/{MAX_LENGTH}
            </p>
            <div className="flex gap-2">
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
                disabled={isSaving}
              >
                {isSaving ? "Sparar..." : "Spara"}
              </Button>
            </div>
          </div>
        </div>
      ) : providerNotes ? (
        <div
          className="p-3 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-colors group"
          onClick={() => handleStartEdit(providerNotes)}
        >
          <div className="flex items-start gap-2">
            <p className="text-sm text-gray-800 flex-1 line-clamp-3">
              {providerNotes}
            </p>
            <PenLine className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          </div>
        </div>
      ) : (
        <button
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          onClick={() => handleStartEdit("")}
        >
          Lägg till anteckning
        </button>
      )}
    </div>
  )
}
