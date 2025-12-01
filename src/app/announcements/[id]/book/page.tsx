"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"

interface RouteStop {
  id: string
  locationName: string
  address: string
  stopOrder: number
}

interface Announcement {
  id: string
  serviceType: string
  dateFrom: string
  dateTo: string
  specialInstructions?: string
  provider: {
    id: string
    businessName: string
    services: Array<{
      id: string
      name: string
      price: number
      durationMinutes: number
    }>
  }
  routeStops: RouteStop[]
}

export default function BookAnnouncementPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isLoading: authLoading } = useAuth()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    serviceId: "",
    bookingDate: "",
    startTime: "",
    endTime: "",
    horseName: "",
    horseInfo: "",
    customerNotes: "",
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (params.id) {
      fetchAnnouncement(params.id as string)
    }
  }, [params.id])

  const fetchAnnouncement = async (id: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/route-orders/${id}`)
      if (response.ok) {
        const data = await response.json()
        setAnnouncement(data)
      } else {
        toast.error("Kunde inte hämta rutt-annons")
        router.push("/announcements")
      }
    } catch (error) {
      console.error("Error fetching announcement:", error)
      toast.error("Något gick fel")
      router.push("/announcements")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: announcement?.provider.id,
          serviceId: formData.serviceId,
          routeOrderId: announcement?.id, // LINK TO ANNOUNCEMENT
          bookingDate: formData.bookingDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          horseName: formData.horseName || undefined,
          horseInfo: formData.horseInfo || undefined,
          customerNotes: formData.customerNotes || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create booking")
      }

      toast.success("Bokning skapad!")
      router.push("/customer/bookings")
    } catch (error) {
      console.error("Error creating booking:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa bokning")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  if (!announcement) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-green-800">
            Equinet
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Link href="/announcements" className="text-green-600 hover:text-green-700 text-sm">
              ← Tillbaka till rutt-annonser
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-2">Boka på rutt</h1>
          <p className="text-gray-600 mb-8">
            Boka {announcement.serviceType} med {announcement.provider.businessName}
          </p>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Announcement Info (Sidebar) */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rutt-information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Leverantör</p>
                    <p className="text-sm">{announcement.provider.businessName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Tjänstetyp</p>
                    <p className="text-sm">{announcement.serviceType}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Datum</p>
                    <p className="text-sm">
                      {formatDate(announcement.dateFrom)} - {formatDate(announcement.dateTo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Platser längs rutten
                    </p>
                    <div className="space-y-1">
                      {announcement.routeStops.map((stop) => (
                        <div key={stop.id} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">{stop.stopOrder}.</span>
                          <span>{stop.locationName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {announcement.specialInstructions && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Information</p>
                      <p className="text-sm text-gray-600">{announcement.specialInstructions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Booking Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Bokningsuppgifter</CardTitle>
                  <CardDescription>
                    Fyll i dina uppgifter för att boka på denna rutt
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Service Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="service">Välj tjänst *</Label>
                      <select
                        id="service"
                        value={formData.serviceId}
                        onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                        className="w-full p-2 border rounded-md"
                        required
                      >
                        <option value="">Välj en tjänst...</option>
                        {announcement.provider.services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} - {service.price} kr ({service.durationMinutes} min)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Booking Date & Time */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bookingDate">Datum *</Label>
                        <Input
                          id="bookingDate"
                          type="date"
                          min={announcement.dateFrom.split("T")[0]}
                          max={announcement.dateTo.split("T")[0]}
                          value={formData.bookingDate}
                          onChange={(e) =>
                            setFormData({ ...formData, bookingDate: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="startTime">Starttid *</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={formData.startTime}
                          onChange={(e) =>
                            setFormData({ ...formData, startTime: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">Sluttid *</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {/* Horse Information */}
                    <div className="space-y-2">
                      <Label htmlFor="horseName">Hästens namn (valfritt)</Label>
                      <Input
                        id="horseName"
                        placeholder="t.ex. Thunder"
                        value={formData.horseName}
                        onChange={(e) => setFormData({ ...formData, horseName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="horseInfo">Information om hästen (valfritt)</Label>
                      <Textarea
                        id="horseInfo"
                        placeholder="t.ex. Lugnhäst, 15 år, inga kända problem"
                        value={formData.horseInfo}
                        onChange={(e) => setFormData({ ...formData, horseInfo: e.target.value })}
                        rows={3}
                      />
                    </div>

                    {/* Customer Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="customerNotes">Övriga önskemål (valfritt)</Label>
                      <Textarea
                        id="customerNotes"
                        placeholder="t.ex. Parkeringsmöjligheter, kontaktinfo, speciella behov"
                        value={formData.customerNotes}
                        onChange={(e) =>
                          setFormData({ ...formData, customerNotes: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex justify-end gap-2 pt-4">
                      <Link href="/announcements">
                        <Button type="button" variant="outline" disabled={isSubmitting}>
                          Avbryt
                        </Button>
                      </Link>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Bokar..." : "Skapa bokning"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
