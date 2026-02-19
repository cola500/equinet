"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface HorseOption {
  id: string
  name: string
  breed: string | null
  specialNeeds: string | null
}

interface HorseSelectProps {
  horses: HorseOption[]
  horseId: string
  horseName: string
  horseInfo: string
  onHorseChange: (data: {
    horseId: string
    horseName: string
    horseInfo: string
  }) => void
  label?: string
}

export function HorseSelect({
  horses,
  horseId,
  horseName,
  horseInfo,
  onHorseChange,
  label = "Häst",
}: HorseSelectProps) {
  if (horses.length === 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor="horseName">{label}</Label>
        <Input
          id="horseName"
          value={horseName}
          onChange={(e) =>
            onHorseChange({ horseId: "", horseName: e.target.value, horseInfo: "" })
          }
          placeholder="Hästens namn"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="horse-select">{label}</Label>
      <Select
        value={horseId}
        onValueChange={(value) => {
          if (value === "__manual__") {
            onHorseChange({ horseId: "", horseName: "", horseInfo: "" })
          } else {
            const horse = horses.find((h) => h.id === value)
            onHorseChange({
              horseId: value,
              horseName: horse?.name || "",
              horseInfo: horse?.specialNeeds || "",
            })
          }
        }}
      >
        <SelectTrigger id="horse-select">
          <SelectValue placeholder="Välj häst..." />
        </SelectTrigger>
        <SelectContent>
          {horses.map((horse) => (
            <SelectItem key={horse.id} value={horse.id}>
              {horse.name}
              {horse.breed && ` (${horse.breed})`}
            </SelectItem>
          ))}
          <SelectItem value="__manual__">Annan häst (ange manuellt)</SelectItem>
        </SelectContent>
      </Select>

      {horseId && horseId !== "__manual__" && horseInfo && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
          {horseInfo}
        </p>
      )}

      {!horseId && (
        <Input
          id="horseName-manual"
          value={horseName}
          onChange={(e) =>
            onHorseChange({ horseId: "", horseName: e.target.value, horseInfo: "" })
          }
          placeholder="Hästens namn"
        />
      )}
    </div>
  )
}
