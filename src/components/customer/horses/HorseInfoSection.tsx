import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription,
  ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import type { Horse } from "@/app/customer/horses/[id]/types"
import { GENDER_LABELS } from "@/app/customer/horses/[id]/types"

interface HorseInfoSectionProps {
  horse: Horse
  editDialogOpen: boolean
  onEditDialogOpenChange: (open: boolean) => void
  editForm: {
    name: string; breed: string; birthYear: string; color: string
    gender: string; specialNeeds: string; registrationNumber: string; microchipNumber: string
  }
  onEditFormChange: (form: HorseInfoSectionProps["editForm"]) => void
  isSaving: boolean
  onOpenEdit: () => void
  onSave: (e: React.FormEvent) => void
}

export function HorseInfoSection({
  horse, editDialogOpen, onEditDialogOpenChange,
  editForm, onEditFormChange, isSaving, onOpenEdit, onSave,
}: HorseInfoSectionProps) {
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Hästinformation</h2>
          <Button variant="outline" size="sm" onClick={onOpenEdit}>Redigera</Button>
        </div>

        <Card>
          <CardContent className="py-4 space-y-4">
            <InfoRow label="Namn" value={horse.name} />
            <InfoRow label="Ras" value={horse.breed} />
            <InfoRow label="Färg" value={horse.color} />
            <InfoRow label="Kön" value={horse.gender ? GENDER_LABELS[horse.gender] || horse.gender : null} />
            <InfoRow label="Födelseår" value={horse.birthYear ? String(horse.birthYear) : null} />
            <InfoRow label="UELN" value={horse.registrationNumber} />
            <InfoRow label="Chipnummer" value={horse.microchipNumber} />
          </CardContent>
        </Card>

        {horse.specialNeeds && (
          <Card>
            <CardContent className="py-4">
              <div className="bg-amber-50 p-3 rounded text-sm text-amber-800">
                <span className="font-medium">Specialbehov:</span> {horse.specialNeeds}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit horse dialog */}
      <ResponsiveDialog open={editDialogOpen} onOpenChange={onEditDialogOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Redigera {horse.name}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Uppdatera information om din häst.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <Label htmlFor="edit-horse-name">Namn *</Label>
              <Input
                id="edit-horse-name"
                value={editForm.name}
                onChange={(e) => onEditFormChange({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-horse-breed">Ras</Label>
                <Input id="edit-horse-breed" value={editForm.breed}
                  onChange={(e) => onEditFormChange({ ...editForm, breed: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-horse-color">Färg</Label>
                <Input id="edit-horse-color" value={editForm.color}
                  onChange={(e) => onEditFormChange({ ...editForm, color: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-horse-birthYear">Födelseår</Label>
                <Input id="edit-horse-birthYear" type="number" value={editForm.birthYear}
                  onChange={(e) => onEditFormChange({ ...editForm, birthYear: e.target.value })}
                  min={1980} max={new Date().getFullYear()} />
              </div>
              <div>
                <Label htmlFor="edit-horse-gender">Kön</Label>
                <Select value={editForm.gender} onValueChange={(v) => onEditFormChange({ ...editForm, gender: v })}>
                  <SelectTrigger id="edit-horse-gender"><SelectValue placeholder="Välj kön" /></SelectTrigger>
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
                <Label htmlFor="edit-horse-regnum">Registreringsnummer</Label>
                <Input id="edit-horse-regnum" value={editForm.registrationNumber}
                  onChange={(e) => onEditFormChange({ ...editForm, registrationNumber: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="edit-horse-chip">Chipnummer</Label>
                <Input id="edit-horse-chip" value={editForm.microchipNumber}
                  onChange={(e) => onEditFormChange({ ...editForm, microchipNumber: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-horse-needs">Speciella behov</Label>
              <Textarea id="edit-horse-needs" value={editForm.specialNeeds}
                onChange={(e) => onEditFormChange({ ...editForm, specialNeeds: e.target.value })} rows={3} />
            </div>
            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={() => onEditDialogOpenChange(false)}>Avbryt</Button>
              <Button type="submit" disabled={isSaving || !editForm.name.trim()}>
                {isSaving ? "Sparar..." : "Spara ändringar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between py-1 border-b last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value || "-"}</span>
    </div>
  )
}
