"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useServices } from "@/hooks/useServices"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"

interface Service {
  id: string
  name: string
  description?: string | null
  price: number
  durationMinutes: number
  isActive: boolean
  recommendedIntervalWeeks?: number | null
}

const INTERVAL_OPTIONS = [
  { value: "", label: "Ingen påminnelse" },
  { value: "4", label: "4 veckor" },
  { value: "6", label: "6 veckor" },
  { value: "8", label: "8 veckor" },
  { value: "12", label: "12 veckor" },
  { value: "26", label: "26 veckor (halvår)" },
  { value: "52", label: "52 veckor (1 år)" },
]

export default function ProviderServicesPage() {
  const { isLoading, isProvider } = useAuth()
  const { services, mutate: mutateServices } = useServices()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    durationMinutes: "",
    recommendedIntervalWeeks: "",
  })

  const { guardMutation } = useOfflineGuard()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await guardMutation(async () => {
      try {
        const url = editingService
          ? `/api/services/${editingService.id}`
          : "/api/services"

        const method = editingService ? "PUT" : "POST"

        // Build payload - only include isActive when updating
        const payload: any = {
          name: formData.name,
          description: formData.description || undefined,
          price: parseFloat(formData.price),
          durationMinutes: parseInt(formData.durationMinutes),
          recommendedIntervalWeeks: formData.recommendedIntervalWeeks
            ? parseInt(formData.recommendedIntervalWeeks)
            : null,
        }

        // Only include isActive when editing (PUT), not when creating (POST)
        if (editingService) {
          payload.isActive = editingService.isActive
        }

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error("Failed to save service")
        }

        toast.success(
          editingService ? "Tjänst uppdaterad!" : "Tjänst skapad!"
        )

        setIsDialogOpen(false)
        resetForm()
        mutateServices()
      } catch (error) {
        console.error("Error saving service:", error)
        toast.error("Kunde inte spara tjänst")
      }
    })
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      durationMinutes: service.durationMinutes.toString(),
      recommendedIntervalWeeks: service.recommendedIntervalWeeks?.toString() || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna tjänst?")) {
      return
    }

    await guardMutation(async () => {
      try {
        const response = await fetch(`/api/services/${id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to delete service")
        }

        toast.success("Tjänst borttagen!")
        mutateServices()
      } catch (error) {
        console.error("Error deleting service:", error)
        toast.error("Kunde inte ta bort tjänst")
      }
    })
  }

  const toggleActive = async (service: Service) => {
    await guardMutation(async () => {
      try {
        const payload = {
          name: service.name,
          description: service.description || undefined,
          price: service.price,
          durationMinutes: service.durationMinutes,
          isActive: !service.isActive,
        }

        console.log("Toggling service with payload:", payload)

        const response = await fetch(`/api/services/${service.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error("API error response:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          })
          throw new Error(`Failed to update service: ${response.status}`)
        }

        toast.success(
          service.isActive ? "Tjänst inaktiverad" : "Tjänst aktiverad"
        )
        mutateServices()
      } catch (error) {
        console.error("Error toggling service:", error)
        toast.error("Kunde inte uppdatera tjänst")
      }
    })
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      durationMinutes: "",
      recommendedIntervalWeeks: "",
    })
    setEditingService(null)
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Mina tjänster</h1>
            <p className="text-gray-600 mt-1">
              Hantera de tjänster du erbjuder
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm()
                  setIsDialogOpen(true)
                }}
              >
                Lägg till tjänst
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Redigera tjänst" : "Lägg till ny tjänst"}
                </DialogTitle>
                <DialogDescription>
                  Fyll i informationen om tjänsten
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tjänstens namn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Beskrivning</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Pris (kr) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Varaktighet (min) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      value={formData.durationMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          durationMinutes: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interval">Återbesöksintervall</Label>
                  <Select
                    value={formData.recommendedIntervalWeeks}
                    onValueChange={(value) =>
                      setFormData({ ...formData, recommendedIntervalWeeks: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger id="interval">
                      <SelectValue placeholder="Ingen påminnelse" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value || "none"}
                          value={option.value || "none"}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Kunder får en påminnelse att boka igen efter valt intervall
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false)
                      resetForm()
                    }}
                  >
                    Avbryt
                  </Button>
                  <Button type="submit">
                    {editingService ? "Uppdatera" : "Skapa"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {services.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inga tjänster ännu
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Börja med att skapa din första tjänst. Lägg till tjänster som hovslagning,
                veterinärvård, eller ridlektioner för att börja ta emot bokningar.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} size="lg">
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Skapa din första tjänst
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {services.map((service) => (
              <Card key={service.id} data-testid="service-item">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{service.name}</CardTitle>
                    <button
                      onClick={() => toggleActive(service)}
                      className={`text-xs px-2 py-1 rounded ${
                        service.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {service.isActive ? "Aktiv" : "Inaktiv"}
                    </button>
                  </div>
                  {service.description && (
                    <CardDescription>{service.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pris:</span>
                      <span className="font-semibold">{service.price} kr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Varaktighet:</span>
                      <span className="font-semibold">
                        {service.durationMinutes} min
                      </span>
                    </div>
                    {service.recommendedIntervalWeeks && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Återbesök:</span>
                        <span className="font-semibold">
                          {service.recommendedIntervalWeeks} veckor
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(service)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Redigera
                    </Button>
                    <Button
                      onClick={() => handleDelete(service.id)}
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                    >
                      Ta bort
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </ProviderLayout>
  )
}
