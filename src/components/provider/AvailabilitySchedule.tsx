"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface AvailabilityDay {
  dayOfWeek: number
  startTime: string
  endTime: string
  isClosed: boolean
}

interface AvailabilityScheduleProps {
  providerId: string
}

const DAYS_OF_WEEK = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
]

export function AvailabilitySchedule({ providerId }: AvailabilityScheduleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [schedule, setSchedule] = useState<AvailabilityDay[]>([])

  useEffect(() => {
    fetchSchedule()
  }, [providerId])

  const fetchSchedule = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/providers/${providerId}/availability-schedule`)

      if (response.ok) {
        const data = await response.json()

        // Skapa ett komplett schema för alla 7 dagar
        // Fyll i med data från DB om det finns, annars default
        const completeSchedule = Array.from({ length: 7 }, (_, dayOfWeek) => {
          const existing = data.find((item: any) => item.dayOfWeek === dayOfWeek)
          if (existing) {
            return {
              dayOfWeek: existing.dayOfWeek,
              startTime: existing.startTime,
              endTime: existing.endTime,
              isClosed: existing.isClosed,
            }
          }
          // Default för dagar som saknas
          return {
            dayOfWeek,
            startTime: "09:00",
            endTime: "17:00",
            isClosed: false,
          }
        })
        setSchedule(completeSchedule)
      }
    } catch (error) {
      console.error("Error fetching schedule:", error)
      toast.error("Kunde inte hämta öppettider")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      const response = await fetch(`/api/providers/${providerId}/availability-schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schedule }),
      })

      if (response.ok) {
        toast.success("Öppettider uppdaterade!")
        setIsEditing(false)
        fetchSchedule() // Refresh data
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Error response:", response.status, errorData)
        toast.error(errorData.details || errorData.error || "Kunde inte spara öppettider")
      }
    } catch (error) {
      console.error("Error saving schedule:", error)
      toast.error("Nätverksfel - kunde inte spara öppettider")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDayChange = (dayIndex: number, field: keyof AvailabilityDay, value: any) => {
    setSchedule((prev) =>
      prev.map((day, i) =>
        i === dayIndex ? { ...day, [field]: value } : day
      )
    )
  }

  const handleCancel = () => {
    setIsEditing(false)
    fetchSchedule() // Reset to saved data
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Öppettider</CardTitle>
          <CardDescription>Ange dina öppettider för varje veckodag</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Laddar...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Öppettider</CardTitle>
        <CardDescription>
          Ange dina öppettider för varje veckodag. Kunder kan bara boka inom dessa tider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <div className="space-y-4">
            {schedule.map((day, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <span className="font-medium w-24">{DAYS_OF_WEEK[day.dayOfWeek]}</span>
                {day.isClosed ? (
                  <span className="text-gray-500 italic">Stängt</span>
                ) : (
                  <span className="text-gray-700">
                    {day.startTime} - {day.endTime}
                  </span>
                )}
              </div>
            ))}
            <div className="pt-4">
              <Button onClick={() => setIsEditing(true)}>
                Redigera öppettider
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {schedule.map((day, index) => (
              <div key={index} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">{DAYS_OF_WEEK[day.dayOfWeek]}</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`closed-${index}`} className="text-sm">
                      Stängt
                    </Label>
                    <Switch
                      id={`closed-${index}`}
                      checked={day.isClosed}
                      onCheckedChange={(checked) =>
                        handleDayChange(index, "isClosed", checked)
                      }
                    />
                  </div>
                </div>

                {!day.isClosed && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`start-${index}`} className="text-sm">
                        Öppnar
                      </Label>
                      <Input
                        id={`start-${index}`}
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          handleDayChange(index, "startTime", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`end-${index}`} className="text-sm">
                        Stänger
                      </Label>
                      <Input
                        id={`end-${index}`}
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          handleDayChange(index, "endTime", e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Sparar..." : "Spara ändringar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
