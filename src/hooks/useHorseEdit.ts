import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useDialogState } from "@/hooks/useDialogState"
import type { Horse } from "@/app/customer/horses/[id]/types"
import { emptyHorseForm } from "@/app/customer/horses/[id]/types"

export function useHorseEdit(horse: Horse | null, onEditComplete: () => void) {
  const editDialog = useDialogState()
  const [editForm, setEditForm] = useState(emptyHorseForm)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const openEditDialog = useCallback(() => {
    if (!horse) return
    setEditForm({
      name: horse.name,
      breed: horse.breed || "",
      birthYear: horse.birthYear?.toString() || "",
      color: horse.color || "",
      gender: horse.gender || "",
      specialNeeds: horse.specialNeeds || "",
      registrationNumber: horse.registrationNumber || "",
      microchipNumber: horse.microchipNumber || "",
    })
    editDialog.openDialog()
  }, [horse, editDialog])

  const handleEditHorse = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!horse) return
    setIsSavingEdit(true)

    try {
      const body: Record<string, unknown> = { name: editForm.name }
      body.breed = editForm.breed || null
      body.birthYear = editForm.birthYear ? parseInt(editForm.birthYear) : null
      body.color = editForm.color || null
      body.gender = editForm.gender || null
      body.specialNeeds = editForm.specialNeeds || null
      body.registrationNumber = editForm.registrationNumber || null
      body.microchipNumber = editForm.microchipNumber || null

      const response = await fetch(`/api/horses/${horse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte uppdatera häst")
      }

      toast.success("Hästen har uppdaterats!")
      editDialog.close()
      setEditForm(emptyHorseForm)
      onEditComplete()
    } catch (error) {
      console.error("Error updating horse:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera häst")
    } finally {
      setIsSavingEdit(false)
    }
  }, [horse, editForm, editDialog, onEditComplete])

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      editDialog.close()
      setEditForm(emptyHorseForm)
    }
  }, [editDialog])

  return {
    editDialog,
    editForm,
    setEditForm,
    isSavingEdit,
    openEditDialog,
    handleEditHorse,
    handleDialogClose,
  }
}
