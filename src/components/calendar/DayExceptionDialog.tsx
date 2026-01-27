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
import { AvailabilityException } from "@/types"

interface DayExceptionDialogProps {
  date: string | null // YYYY-MM-DD
  exception: AvailabilityException | null // Existing exception for this date, if any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    date: string
    isClosed: boolean
    startTime?: string | null
    endTime?: string | null
    reason?: string | null
    location?: string | null
    latitude?: number | null
    longitude?: number | null
  }) => Promise<void>
  onDelete: (date: string) => Promise<void>
}

function formatDate(dateString: string): string {
  // Parse YYYY-MM-DD format explicitly to avoid timezone issues
  const [year, month, day] = dateString.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function DayExceptionDialog({
  date,
  exception,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: DayExceptionDialogProps) {
  const [isClosed, setIsClosed] = useState(false)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [reason, setReason] = useState("")
  const [location, setLocation] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (exception) {
      setIsClosed(exception.isClosed)
      setStartTime(exception.startTime || "09:00")
      setEndTime(exception.endTime || "17:00")
      setReason(exception.reason || "")
      setLocation(exception.location || "")
    } else {
      // Default: open with default hours (main use case is setting location)
      setIsClosed(false)
      setStartTime("09:00")
      setEndTime("17:00")
      setReason("")
      setLocation("")
    }
  }, [exception, open])

  if (!date) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave({
        date,
        isClosed,
        startTime: isClosed ? null : startTime,
        endTime: isClosed ? null : endTime,
        reason: reason.trim() || null,
        location: location.trim() || null,
        // Note: latitude/longitude can be added later with geocoding
        latitude: null,
        longitude: null,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving exception:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!exception) return
    setIsDeleting(true)
    try {
      await onDelete(date)
      onOpenChange(false)
    } catch (error) {
      console.error("Error deleting exception:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const isProcessing = isSaving || isDeleting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {exception ? "Redigera undantag" : "Lägg till undantag"}
          </DialogTitle>
          <DialogDescription className="capitalize">
            {formatDate(date)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="isClosed">Stängt hela dagen</Label>
            <Switch
              id="isClosed"
              checked={isClosed}
              onCheckedChange={setIsClosed}
              disabled={isProcessing}
            />
          </div>

          {!isClosed && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Öppnar</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div>
                <Label htmlFor="endTime">Stänger</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="reason">Anledning (valfritt)</Label>
            <Input
              id="reason"
              type="text"
              placeholder="T.ex. Semester, Sjuk, Utbildning..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              disabled={isProcessing}
            />
          </div>

          <div>
            <Label htmlFor="location">Arbetsplats denna dag (valfritt)</Label>
            <Input
              id="location"
              type="text"
              placeholder="T.ex. Sollebrunn, Alingsås centrum..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={100}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ange var du jobbar denna dag så kan kunder i närheten hitta dig
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isProcessing} className="flex-1">
              {isSaving ? "Sparar..." : "Spara"}
            </Button>
            {exception && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isProcessing}
              >
                {isDeleting ? "Tar bort..." : "Ta bort"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
