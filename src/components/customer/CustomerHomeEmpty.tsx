"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HorseIcon } from "@/components/icons/HorseIcon"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog"
import { HorseForm, emptyHorseForm, type HorseFormData } from "@/components/horses/HorseForm"
import { clientLogger } from "@/lib/client-logger"

/**
 * Calm 0-horses prompt for /hem — a single warm first step, never the public
 * search and never empty card placeholders. The button adds the first horse.
 */
export function CustomerHomeEmpty({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<HorseFormData>(emptyHorseForm)
  const [isSaving, setIsSaving] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = { name: formData.name }
      if (formData.breed) body.breed = formData.breed
      if (formData.birthYear) body.birthYear = parseInt(formData.birthYear)
      if (formData.color) body.color = formData.color
      if (formData.gender) body.gender = formData.gender
      if (formData.specialNeeds) body.specialNeeds = formData.specialNeeds

      const response = await fetch("/api/horses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte lägga till häst")
      }
      toast.success("Hästen har lagts till!")
      setOpen(false)
      setFormData(emptyHorseForm)
      onAdded()
    } catch (error) {
      clientLogger.error("Error adding horse:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till häst")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center text-center py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-5">
        <HorseIcon className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Lägg till din första häst</h2>
      <p className="text-gray-600 max-w-sm mb-6">
        Så håller vi koll på när det är dags för hovslagare och veterinär — och påminner dig i tid.
      </p>
      <Button onClick={() => setOpen(true)} size="lg">
        Lägg till häst
      </Button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Lägg till häst</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Fyll i information om din häst. Namn är obligatoriskt, resten är valfritt.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <HorseForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAdd}
            isSaving={isSaving}
            submitLabel="Lägg till"
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
