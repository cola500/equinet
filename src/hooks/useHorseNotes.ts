import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useDialogState } from "@/hooks/useDialogState"
import { emptyNoteForm } from "@/app/customer/horses/[id]/types"

export function useHorseNotes(horseId: string, onNoteAdded: () => void) {
  const noteDialog = useDialogState()
  const [noteForm, setNoteForm] = useState(emptyNoteForm)
  const [isSaving, setIsSaving] = useState(false)

  const handleAddNote = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch(`/api/horses/${horseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: noteForm.category,
          title: noteForm.title,
          content: noteForm.content || undefined,
          noteDate: new Date(noteForm.noteDate).toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa anteckning")
      }

      toast.success("Anteckning tillagd!")
      noteDialog.close()
      setNoteForm(emptyNoteForm)
      onNoteAdded()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skapa anteckning"
      )
    } finally {
      setIsSaving(false)
    }
  }, [horseId, noteForm, noteDialog, onNoteAdded])

  return { noteDialog, noteForm, setNoteForm, isSaving, handleAddNote }
}
