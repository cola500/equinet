"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Service {
  id: string
  name: string
  description?: string
  price: number
  durationMinutes: number
  isActive: boolean
}

export default function ProviderServicesPage() {
  const router = useRouter()
  const { user, isLoading, isProvider } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    durationMinutes: "",
  })

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchServices()
    }
  }, [isProvider])

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services")
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error("Error fetching services:", error)
      toast.error("Kunde inte hämta tjänster")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
      fetchServices()
    } catch (error) {
      console.error("Error saving service:", error)
      toast.error("Kunde inte spara tjänst")
    }
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      durationMinutes: service.durationMinutes.toString(),
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna tjänst?")) {
      return
    }

    try {
      const response = await fetch(`/api/services/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete service")
      }

      toast.success("Tjänst borttagen!")
      fetchServices()
    } catch (error) {
      console.error("Error deleting service:", error)
      toast.error("Kunde inte ta bort tjänst")
    }
  }

  const toggleActive = async (service: Service) => {
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
      fetchServices()
    } catch (error) {
      console.error("Error toggling service:", error)
      toast.error("Kunde inte uppdatera tjänst")
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      durationMinutes: "",
    })
    setEditingService(null)
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
  }

  if (isLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-green-800">
            Equinet
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logga ut
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-6">
            <Link
              href="/provider/dashboard"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/provider/services"
              className="py-3 border-b-2 border-green-600 text-green-600 font-medium"
            >
              Mina tjänster
            </Link>
            <Link
              href="/provider/bookings"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Bokningar
            </Link>
            <Link
              href="/provider/profile"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Min profil
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mina tjänster</h1>
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
              <p className="text-gray-600 mb-4">
                Du har inga tjänster ännu. Skapa din första tjänst för att komma
                igång!
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                Lägg till tjänst
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id}>
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
      </main>
    </div>
  )
}
