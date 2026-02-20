"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { MunicipalitySelect } from "@/components/ui/municipality-select"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"

interface ProviderService {
  id: string
  name: string
  description?: string
  price: number
}

export default function NewAnnouncementPage() {
  const router = useRouter()
  const { isLoading, isProvider, user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [services, setServices] = useState<ProviderService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    municipality: "",
    dateFrom: "",
    dateTo: "",
    specialInstructions: "",
  })
  const { guardMutation } = useOfflineGuard()

  // Fetch provider's services
  useEffect(() => {
    if (isProvider && user) {
      fetchServices()
    }
  }, [isProvider, user])

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services")
      if (response.ok) {
        const data = await response.json()
        setServices(data.filter((s: ProviderService & { isActive?: boolean }) => s.isActive !== false))
      }
    } catch (error) {
      console.error("Error fetching services:", error)
      toast.error("Kunde inte hämta dina tjänster")
    } finally {
      setServicesLoading(false)
    }
  }

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await guardMutation(async () => {
      setIsSubmitting(true)

      try {
        if (selectedServiceIds.length === 0) {
          toast.error("Välj minst en tjänst")
          setIsSubmitting(false)
          return
        }

        if (!formData.municipality) {
          toast.error("Välj en kommun")
          setIsSubmitting(false)
          return
        }

        if (formData.dateTo && formData.dateFrom && new Date(formData.dateTo) < new Date(formData.dateFrom)) {
          toast.error("Till-datum kan inte vara före från-datum")
          setIsSubmitting(false)
          return
        }

        const payload = {
          announcementType: "provider_announced",
          serviceIds: selectedServiceIds,
          dateFrom: formData.dateFrom,
          dateTo: formData.dateTo,
          municipality: formData.municipality,
          specialInstructions: formData.specialInstructions || undefined,
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
    })
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
            Annonsera din planerade rutt så kunder i kommunen kan boka in sig
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rutt-information</CardTitle>
            <CardDescription>
              Välj tjänster, kommun och datumperiod
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Services Selection */}
              <div className="space-y-3">
                <Label>Tjänster *</Label>
                {servicesLoading ? (
                  <p className="text-sm text-gray-500">Laddar tjänster...</p>
                ) : services.length === 0 ? (
                  <div className="p-4 border rounded-md bg-yellow-50 text-sm text-yellow-800">
                    Du har inga aktiva tjänster. <a href="/provider/services" className="underline font-medium">Skapa tjänster först</a>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                      >
                        <Checkbox
                          checked={selectedServiceIds.includes(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{service.name}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            {service.price} kr
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Municipality */}
              <div className="space-y-2">
                <Label htmlFor="municipality">Kommun *</Label>
                <MunicipalitySelect
                  id="municipality"
                  value={formData.municipality}
                  onChange={(value) => setFormData({ ...formData, municipality: value })}
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

              {/* Special Instructions */}
              <div className="space-y-2">
                <Label htmlFor="specialInstructions">Övrig information (valfritt)</Label>
                <Textarea
                  id="specialInstructions"
                  placeholder="t.ex. Tidpunkt, kontaktinfo, extra information"
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
                <Button type="submit" disabled={isSubmitting || services.length === 0}>
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
