"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface RouteStop {
  locationName: string
  address: string
}

export default function NewAnnouncementPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stops, setStops] = useState<RouteStop[]>([
    { locationName: "", address: "" }
  ])
  const [formData, setFormData] = useState({
    serviceType: "",
    dateFrom: "",
    dateTo: "",
    specialInstructions: "",
  })

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate stops have required data
      const validStops = stops.filter(stop =>
        stop.locationName.trim() && stop.address.trim()
      )

      if (validStops.length === 0) {
        toast.error("Lägg till minst en plats för din rutt")
        setIsSubmitting(false)
        return
      }

      if (validStops.length > 3) {
        toast.error("Max 3 platser tillåtna")
        setIsSubmitting(false)
        return
      }

      const payload = {
        announcementType: "provider_announced",
        serviceType: formData.serviceType,
        dateFrom: formData.dateFrom,
        dateTo: formData.dateTo,
        specialInstructions: formData.specialInstructions || undefined,
        stops: validStops,
      }

      const response = await fetch("/api/route-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create announcement")
      }

      toast.success("Rutt-annons skapad!")
      router.push("/provider/announcements")
    } catch (error) {
      console.error("Error creating announcement:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa rutt-annons")
    } finally {
      setIsSubmitting(false)
    }
  }

  const addStop = () => {
    if (stops.length < 3) {
      setStops([...stops, { locationName: "", address: "" }])
    }
  }

  const removeStop = (index: number) => {
    if (stops.length > 1) {
      setStops(stops.filter((_, i) => i !== index))
    }
  }

  const updateStop = (index: number, field: keyof RouteStop, value: string) => {
    const updatedStops = [...stops]
    updatedStops[index] = { ...updatedStops[index], [field]: value }
    setStops(updatedStops)
  }

  if (isLoading || !isProvider) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Skapa rutt-annons</h1>
          <p className="text-gray-600 mt-1">
            Annonsera din planerade rutt så kunder kan boka in sig längs vägen
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rutt-information</CardTitle>
            <CardDescription>
              Fyll i information om din planerade rutt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service Type */}
              <div className="space-y-2">
                <Label htmlFor="serviceType">Tjänstetyp *</Label>
                <Input
                  id="serviceType"
                  placeholder="t.ex. Hovslagning, Massage, Veterinärvård"
                  value={formData.serviceType}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceType: e.target.value })
                  }
                  required
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">Från datum *</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={formData.dateFrom}
                    onChange={(e) =>
                      setFormData({ ...formData, dateFrom: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">Till datum *</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={formData.dateTo}
                    onChange={(e) =>
                      setFormData({ ...formData, dateTo: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Route Stops */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Platser längs rutten * (1-3 st)</Label>
                  {stops.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStop}
                    >
                      + Lägg till plats
                    </Button>
                  )}
                </div>

                {stops.map((stop, index) => (
                  <Card key={index} className="border-dashed">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold">Plats {index + 1}</h4>
                        {stops.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStop(index)}
                          >
                            Ta bort
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`locationName-${index}`}>Platsnamn *</Label>
                        <Input
                          id={`locationName-${index}`}
                          placeholder="t.ex. Alingsås centrum"
                          value={stop.locationName}
                          onChange={(e) => updateStop(index, "locationName", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`address-${index}`}>Adress *</Label>
                        <Input
                          id={`address-${index}`}
                          placeholder="t.ex. Storgatan 1, Alingsås"
                          value={stop.address}
                          onChange={(e) => updateStop(index, "address", e.target.value)}
                          required
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Special Instructions */}
              <div className="space-y-2">
                <Label htmlFor="specialInstructions">Övrig information (valfritt)</Label>
                <Textarea
                  id="specialInstructions"
                  placeholder="t.ex. Tidpunkt, parkeringsmöjligheter, kontaktinfo"
                  value={formData.specialInstructions}
                  onChange={(e) =>
                    setFormData({ ...formData, specialInstructions: e.target.value })
                  }
                  rows={4}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/provider/announcements")}
                  disabled={isSubmitting}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Skapar..." : "Skapa rutt-annons"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProviderLayout>
  )
}
