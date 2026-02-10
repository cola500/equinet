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

export default function CreateGroupBookingPage() {
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    serviceType: "",
    locationName: "",
    address: "",
    dateFrom: "",
    dateTo: "",
    maxParticipants: "6",
    notes: "",
  })

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const body = {
        serviceType: formData.serviceType,
        locationName: formData.locationName,
        address: formData.address,
        dateFrom: new Date(formData.dateFrom).toISOString(),
        dateTo: new Date(formData.dateTo).toISOString(),
        maxParticipants: parseInt(formData.maxParticipants),
        ...(formData.notes && { notes: formData.notes }),
      }

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
