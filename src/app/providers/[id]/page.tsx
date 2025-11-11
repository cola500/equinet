"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { format, addDays } from "date-fns"
import { sv } from "date-fns/locale"

interface Service {
  id: string
  name: string
  description?: string
  price: number
  durationMinutes: number
}

interface Provider {
  id: string
  businessName: string
  description?: string
  city?: string
  address?: string
  services: Service[]
  user: {
    firstName: string
    lastName: string
    phone?: string
  }
}

export default function ProviderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isAuthenticated, isCustomer } = useAuth()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [bookingForm, setBookingForm] = useState({
    bookingDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    startTime: "09:00",
    horseName: "",
    horseInfo: "",
    customerNotes: "",
  })

  useEffect(() => {
    if (params.id) {
      fetchProvider()
    }
  }, [params.id])

  const fetchProvider = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/providers/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setProvider(data)
      } else {
        toast.error("Leverantör hittades inte")
        router.push("/providers")
      }
    } catch (error) {
      console.error("Error fetching provider:", error)
      toast.error("Kunde inte hämta leverantör")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBookService = (service: Service) => {
    if (!isAuthenticated) {
      toast.error("Du måste logga in för att boka")
      router.push("/login")
      return
    }

    if (!isCustomer) {
      toast.error("Endast kunder kan göra bokningar")
      return
    }

    setSelectedService(service)
    setIsBookingDialogOpen(true)
  }

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(":").map(Number)
    const totalMinutes = hours * 60 + minutes + durationMinutes
    const endHours = Math.floor(totalMinutes / 60)
    const endMinutes = totalMinutes % 60
    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`
  }

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedService || !provider) return

    try {
      const endTime = calculateEndTime(
        bookingForm.startTime,
        selectedService.durationMinutes
      )

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: provider.id,
          serviceId: selectedService.id,
          bookingDate: bookingForm.bookingDate,
          startTime: bookingForm.startTime,
          endTime,
          horseName: bookingForm.horseName,
          horseInfo: bookingForm.horseInfo,
          customerNotes: bookingForm.customerNotes,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create booking")
      }

      toast.success("Bokningsförfrågan skickad!")
      setIsBookingDialogOpen(false)
      router.push("/customer/bookings")
    } catch (error) {
      console.error("Error creating booking:", error)
      toast.error("Kunde inte skapa bokning")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  if (!provider) {
    return null
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
            <Link href="/providers">
              <Button variant="ghost">Tillbaka till leverantörer</Button>
            </Link>
            {user && (
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Provider Info */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-3xl">{provider.businessName}</CardTitle>
              <CardDescription className="text-lg">
                {provider.user.firstName} {provider.user.lastName}
                {provider.city && ` • ${provider.city}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {provider.description && (
                <p className="text-gray-700 mb-4">{provider.description}</p>
              )}
              {provider.address && (
                <p className="text-sm text-gray-600">📍 {provider.address}</p>
              )}
              {provider.user.phone && (
                <p className="text-sm text-gray-600">📞 {provider.user.phone}</p>
              )}
            </CardContent>
          </Card>

          {/* Services */}
          <h2 className="text-2xl font-bold mb-4">Tillgängliga tjänster</h2>
          {provider.services.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-600">
                Inga aktiva tjänster tillgängliga just nu.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {provider.services.map((service) => (
                <Card key={service.id}>
                  <CardHeader>
                    <CardTitle>{service.name}</CardTitle>
                    {service.description && (
                      <CardDescription>{service.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pris:</span>
                        <span className="font-semibold">{service.price} kr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Varaktighet:</span>
                        <span className="font-semibold">
                          {service.durationMinutes} min
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleBookService(service)}
                      className="w-full"
                    >
                      Boka denna tjänst
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Boka {selectedService?.name}</DialogTitle>
            <DialogDescription>
              Fyll i dina uppgifter för att skicka en bokningsförfrågan
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bookingDate">Datum *</Label>
              <Input
                id="bookingDate"
                type="date"
                value={bookingForm.bookingDate}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, bookingDate: e.target.value })
                }
                min={format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Önskad starttid *</Label>
              <Input
                id="startTime"
                type="time"
                value={bookingForm.startTime}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, startTime: e.target.value })
                }
                required
              />
              <p className="text-xs text-gray-600">
                Varaktighet: {selectedService?.durationMinutes} min
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="horseName">Hästens namn</Label>
              <Input
                id="horseName"
                value={bookingForm.horseName}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, horseName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horseInfo">Information om hästen</Label>
              <Textarea
                id="horseInfo"
                value={bookingForm.horseInfo}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, horseInfo: e.target.value })
                }
                rows={2}
                placeholder="T.ex. ålder, ras, särskilda behov..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerNotes">Övriga kommentarer</Label>
              <Textarea
                id="customerNotes"
                value={bookingForm.customerNotes}
                onChange={(e) =>
                  setBookingForm({
                    ...bookingForm,
                    customerNotes: e.target.value,
                  })
                }
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBookingDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button type="submit">Skicka bokningsförfrågan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
