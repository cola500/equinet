"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ResponsiveDialogFooter } from "@/components/ui/responsive-dialog"

export interface HorseFormData {
  name: string
  breed: string
  birthYear: string
  color: string
  gender: string
  specialNeeds: string
  registrationNumber: string
  microchipNumber: string
}

export const emptyHorseForm: HorseFormData = {
  name: "",
  breed: "",
  birthYear: "",
  color: "",
  gender: "",
  specialNeeds: "",
  registrationNumber: "",
  microchipNumber: "",
}

interface HorseFormProps {
  formData: HorseFormData
  setFormData: (data: HorseFormData) => void
  onSubmit: (e: React.FormEvent) => void
  isSaving: boolean
  submitLabel: string
}

export function HorseForm({ formData, setFormData, onSubmit, isSaving, submitLabel }: HorseFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="horse-name">Namn *</Label>
        <Input
          id="horse-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="T.ex. Blansen"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="horse-breed">Ras</Label>
          <Input
            id="horse-breed"
            value={formData.breed}
            onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
            placeholder="T.ex. Svenskt varmblod"
          />
        </div>
        <div>
          <Label htmlFor="horse-color">Färg</Label>
          <Input
            id="horse-color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            placeholder="T.ex. Brun"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="horse-birthYear">Födelseår</Label>
          <Input
            id="horse-birthYear"
            type="number"
            value={formData.birthYear}
            onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
            placeholder="T.ex. 2018"
            min={1980}
            max={new Date().getFullYear()}
          />
        </div>
        <div>
          <Label htmlFor="horse-gender">Kön</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => setFormData({ ...formData, gender: value })}
          >
            <SelectTrigger id="horse-gender">
              <SelectValue placeholder="Välj..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mare">Sto</SelectItem>
              <SelectItem value="gelding">Valack</SelectItem>
              <SelectItem value="stallion">Hingst</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="horse-registrationNumber">Registreringsnummer (UELN)</Label>
          <Input
            id="horse-registrationNumber"
            value={formData.registrationNumber}
            onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
            placeholder="T.ex. 752009876543210"
            maxLength={15}
          />
        </div>
        <div>
          <Label htmlFor="horse-microchipNumber">Chipnummer</Label>
          <Input
            id="horse-microchipNumber"
            value={formData.microchipNumber}
            onChange={(e) => setFormData({ ...formData, microchipNumber: e.target.value })}
            placeholder="T.ex. 752093100012345"
            maxLength={15}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="horse-specialNeeds">Specialbehov</Label>
        <Textarea
          id="horse-specialNeeds"
          value={formData.specialNeeds}
          onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
          placeholder="T.ex. känslig på vänster fram, allergier, medicinsk historik..."
          rows={3}
        />
      </div>

      <ResponsiveDialogFooter>
        <Button type="submit" disabled={isSaving || !formData.name.trim()}>
          {isSaving ? "Sparar..." : submitLabel}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}
