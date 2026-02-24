"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { Loader2 } from "lucide-react"
import type { CustomerHorse, HorseFormData } from "./types"
import { emptyHorseForm } from "./types"

interface AddEditHorseDialogProps {
  open: boolean
  customerId: string
  horseToEdit: CustomerHorse | null
  isSaving: boolean
  onSave: (customerId: string, form: HorseFormData, isEdit: boolean, horseId?: string) => void
  onClose: () => void
}

export function AddEditHorseDialog({
  open,
  customerId,
  horseToEdit,
  isSaving,
  onSave,
  onClose,
}: AddEditHorseDialogProps) {
  const [horseForm, setHorseForm] = useState<HorseFormData>(emptyHorseForm)

  useEffect(() => {
    if (horseToEdit) {
      setHorseForm({
        name: horseToEdit.name,
        breed: horseToEdit.breed || "",
        birthYear: horseToEdit.birthYear ? String(horseToEdit.birthYear) : "",
        color: horseToEdit.color || "",
        gender: horseToEdit.gender || "",
        specialNeeds: horseToEdit.specialNeeds || "",
        registrationNumber: horseToEdit.registrationNumber || "",
        microchipNumber: horseToEdit.microchipNumber || "",
      })
    } else {
      setHorseForm(emptyHorseForm)
    }
  }, [horseToEdit])

  const handleClose = () => {
    setHorseForm(emptyHorseForm)
    onClose()
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {horseToEdit ? "Redigera häst" : "Lägg till häst"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {horseToEdit
              ? "Uppdatera hästens uppgifter."
              : "Registrera en häst åt kunden."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="horseName">Namn *</Label>
              <Input
                id="horseName"
                value={horseForm.name}
                onChange={(e) => setHorseForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Blansen"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="horseBreed">Ras</Label>
              <Input
                id="horseBreed"
                value={horseForm.breed}
                onChange={(e) => setHorseForm((f) => ({ ...f, breed: e.target.value }))}
                placeholder="Islandshäst"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="horseBirthYear">Födelseår</Label>
              <Input
                id="horseBirthYear"
                type="number"
                value={horseForm.birthYear}
                onChange={(e) => setHorseForm((f) => ({ ...f, birthYear: e.target.value }))}
                placeholder="2015"
                min={1980}
                max={new Date().getFullYear()}
              />
            </div>
            <div>
              <Label htmlFor="horseColor">Färg</Label>
              <Input
                id="horseColor"
                value={horseForm.color}
                onChange={(e) => setHorseForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="Brun"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="horseGender">Kön</Label>
              <Select
                value={horseForm.gender}
                onValueChange={(value) => setHorseForm((f) => ({ ...f, gender: value }))}
              >
                <SelectTrigger id="horseGender">
                  <SelectValue placeholder="Välj..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mare">Sto</SelectItem>
                  <SelectItem value="gelding">Valack</SelectItem>
                  <SelectItem value="stallion">Hingst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="horseRegNumber">Reg.nr (UELN)</Label>
              <Input
                id="horseRegNumber"
                value={horseForm.registrationNumber}
                onChange={(e) => setHorseForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                placeholder="752009000000000"
                maxLength={15}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="horseMicrochip">Chipnummer</Label>
            <Input
              id="horseMicrochip"
              value={horseForm.microchipNumber}
              onChange={(e) => setHorseForm((f) => ({ ...f, microchipNumber: e.target.value }))}
              placeholder="752098100000000"
              maxLength={15}
            />
          </div>
          <div>
            <Label htmlFor="horseSpecialNeeds">Specialbehov</Label>
            <VoiceTextarea
              id="horseSpecialNeeds"
              value={horseForm.specialNeeds}
              onChange={(value) => setHorseForm((f) => ({ ...f, specialNeeds: value }))}
              placeholder="T.ex. allergier, rädsla, medicinering..."
              rows={2}
              maxLength={1000}
              className="resize-none"
            />
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => onSave(customerId, horseForm, !!horseToEdit, horseToEdit?.id)}
            disabled={!horseForm.name.trim() || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {horseToEdit ? "Spara" : "Lägg till"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
