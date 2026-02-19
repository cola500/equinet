"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HorseSelect, type HorseOption } from "@/components/booking/HorseSelect"

export default function CreateGroupBookingPage() {
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [horses, setHorses] = useState<HorseOption[]>([])

  const [formData, setFormData] = useState({
    serviceType: "",
    locationName: "",
    address: "",
    dateFrom: "",
    dateTo: "",
    maxParticipants: "6",
    joinDeadline: "",
    horseId: "",
    horseName: "",
    horseInfo: "",
    notes: "",
  })

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  // Fetch customer's horses
  useEffect(() => {
    if (authLoading || !isCustomer) return
    fetch("/api/horses")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setHorses(
            data.map((h: any) => ({
              id: h.id,
              name: h.name,
              breed: h.breed || null,
              specialNeeds: h.specialNeeds || null,
            }))
          )
        }
      })
      .catch(() => {})
  }, [authLoading, isCustomer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const body: Record<string, unknown> = {
        serviceType: formData.serviceType,
        locationName: formData.locationName,
        address: formData.address,
        dateFrom: new Date(formData.dateFrom).toISOString(),
        dateTo: new Date(formData.dateTo).toISOString(),
        maxParticipants: parseInt(formData.maxParticipants),
        numberOfHorses: 1,
      }
      if (formData.notes) body.notes = formData.notes
      if (formData.joinDeadline) body.joinDeadline = new Date(formData.joinDeadline).toISOString()
      if (formData.horseId) body.horseId = formData.horseId
      if (formData.horseName) body.horseName = formData.horseName
      if (formData.horseInfo) body.horseInfo = formData.horseInfo

      const response = await fetch("/api/group-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa grupprequest")
      }

      const created = await response.json()
      toast.success("Grupprequest skapad! Dela inbjudningskoden med dina stallkompisar.")
      router.push(`/customer/group-bookings/${created.id}`)
    } catch (error) {
      console.error("Error creating group booking:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa grupprequest")
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading || !isCustomer) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  // Min date = tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split("T")[0]

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Skapa grupprequest</h1>
        <p className="text-gray-600 mb-8">
          Samordna ett leverantörsbesök med andra hästägare i ditt stall.
          Du får en inbjudningskod att dela med de andra.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Uppgifter om besök</CardTitle>
            <CardDescription>
              Fyll i vilken tjänst ni behöver och var ni finns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="serviceType">Tjänsttyp *</Label>
                <Input
                  id="serviceType"
                  value={formData.serviceType}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceType: e.target.value })
                  }
                  placeholder="T.ex. hovslagning, massagebehandling, tandvård..."
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Skriv vad för typ av tjänst ni söker. Leverantören väljer sin exakta tjänst vid match.
                </p>
              </div>

              <div>
                <Label htmlFor="locationName">Platsnamn *</Label>
                <Input
                  id="locationName"
                  value={formData.locationName}
                  onChange={(e) =>
                    setFormData({ ...formData, locationName: e.target.value })
                  }
                  placeholder="T.ex. Sollebrunn Ridklubb"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Adress *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="T.ex. Stallvägen 1, 441 91 Alingsås"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Från datum *</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={formData.dateFrom}
                    onChange={(e) =>
                      setFormData({ ...formData, dateFrom: e.target.value })
                    }
                    min={minDate}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dateTo">Till datum *</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={formData.dateTo}
                    onChange={(e) =>
                      setFormData({ ...formData, dateTo: e.target.value })
                    }
                    min={formData.dateFrom || minDate}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maxParticipants">Max antal deltagare</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) =>
                    setFormData({ ...formData, maxParticipants: e.target.value })
                  }
                  min={2}
                  max={20}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Minst 2, max 20 deltagare.
                </p>
              </div>

              <div>
                <Label className="text-base font-medium">Din häst</Label>
                <HorseSelect
                  horses={horses}
                  horseId={formData.horseId}
                  horseName={formData.horseName}
                  horseInfo={formData.horseInfo}
                  onHorseChange={({ horseId, horseName, horseInfo }) =>
                    setFormData((prev) => ({ ...prev, horseId, horseName, horseInfo }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="joinDeadline">Sista datum att ansluta (valfritt)</Label>
                <Input
                  id="joinDeadline"
                  type="datetime-local"
                  value={formData.joinDeadline}
                  onChange={(e) =>
                    setFormData({ ...formData, joinDeadline: e.target.value })
                  }
                  min={formData.dateFrom ? `${formData.dateFrom}T00:00` : undefined}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Efter detta datum kan inga fler deltagare gå med.
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Anteckningar</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="T.ex. vi har 6 hästar totalt, behöver förvaring i stallet..."
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Skapar..." : "Skapa grupprequest"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/customer/group-bookings")}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  )
}
