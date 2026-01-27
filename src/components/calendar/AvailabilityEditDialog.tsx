"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AvailabilityDay } from "@/types"

const DAYS_OF_WEEK = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
]

interface AvailabilityEditDialogProps {
  availability: AvailabilityDay | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (availability: AvailabilityDay) => void
}

export function AvailabilityEditDialog({
  availability,
  open,
  onOpenChange,
  onSave,
}: AvailabilityEditDialogProps) {
  const [formData, setFormData] = useState<AvailabilityDay>({
    dayOfWeek: 0,
    startTime: "09:00",
    endTime: "17:00",
    isClosed: false,
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (availability) {
      setFormData(availability)
    }
  }, [availability])

  if (!availability) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Redigera öppettider</DialogTitle>
          <DialogDescription>
            {DAYS_OF_WEEK[availability.dayOfWeek]}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="isClosed">Stängt hela dagen</Label>
            <Switch
              id="isClosed"
              checked={formData.isClosed}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isClosed: checked })
              }
            />
          </div>

          {!formData.isClosed && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Öppnar</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="endTime">Stänger</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSaving} className="flex-1">
              {isSaving ? "Sparar..." : "Spara"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
