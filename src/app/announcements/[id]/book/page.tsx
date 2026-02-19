"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { CustomerBookingCalendar } from "@/components/booking/CustomerBookingCalendar"
import { HorseSelect, type HorseOption } from "@/components/booking/HorseSelect"
import { useHorses } from "@/hooks/useHorses"
import { CustomerLocation } from "@/hooks/useWeekAvailability"

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
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null)
  const { horses } = useHorses()
  const [formData, setFormData] = useState({
    serviceId: "",
    bookingDate: "",
    startTime: "09:00",
    endTime: "10:00",
    horseId: "",
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

  // Fetch customer location for travel time calculation
  useEffect(() => {
    if (!user) return

    const fetchCustomerLocation = async () => {
      try {
        const response = await fetch("/api/profile")
        if (!response.ok) return

        const profile = await response.json()
        if (profile.latitude && profile.longitude) {
          setCustomerLocation({
            latitude: profile.latitude,
            longitude: profile.longitude,
          })
        }
      } catch (error) {
        console.error("Error fetching customer location:", error)
      }
    }

    fetchCustomerLocation()
  }, [user])

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

    // Validate that user has selected a time slot
    if (!formData.bookingDate || !formData.startTime || !formData.endTime) {
      toast.error("Du måste välja en tid i kalendern")
      return
    }

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
          horseId: formData.horseId || undefined,
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

  // Get selected service to determine duration for calendar
  const selectedService = useMemo(() => {
    if (!announcement || !formData.serviceId) return null
    return announcement.provider.services.find((s) => s.id === formData.serviceId)
  }, [announcement, formData.serviceId])

  // Convert horses to HorseOption format for HorseSelect
  const horseOptions: HorseOption[] = useMemo(
    () => horses.map((h) => ({ id: h.id, name: h.name, breed: h.breed, specialNeeds: h.specialNeeds })),
    [horses]
  )

  // Handle slot selection from calendar
  const handleSlotSelect = (date: string, startTime: string, endTime: string) => {
    setFormData((prev) => ({
      ...prev,
      bookingDate: date,
      startTime,
      endTime,
    }))
  }

  if (authLoading || isLoading) {
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

  if (!announcement) {
    return null
  }

  return (
    <CustomerLayout>
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
                        className="w-full p-2 touch-target border rounded-md"
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

                    {/* Calendar for time selection */}
                    {selectedService ? (
                      <div className="space-y-2">
                        <Label>Välj tid *</Label>
                        <CustomerBookingCalendar
                          providerId={announcement.provider.id}
                          serviceDurationMinutes={selectedService.durationMinutes}
                          onSlotSelect={handleSlotSelect}
                          customerLocation={customerLocation || undefined}
                          dateRange={{ from: announcement.dateFrom, to: announcement.dateTo }}
                        />
                        {formData.bookingDate && formData.startTime && (
                          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-800">
                              <span className="font-semibold">Vald tid:</span>{" "}
                              {new Date(formData.bookingDate).toLocaleDateString("sv-SE", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}{" "}
                              kl. {formData.startTime} - {formData.endTime}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                        <p className="text-sm text-gray-600 text-center">
                          Välj en tjänst ovan för att se lediga tider
                        </p>
                      </div>
                    )}

                    {/* Hidden inputs for form validation */}
                    <input
                      type="hidden"
                      name="bookingDate"
                      value={formData.bookingDate}
                      required
                    />
                    <input
                      type="hidden"
                      name="startTime"
                      value={formData.startTime}
                      required
                    />
                    <input
                      type="hidden"
                      name="endTime"
                      value={formData.endTime}
                      required
                    />

                    {/* Horse Selection */}
                    <HorseSelect
                      horses={horseOptions}
                      horseId={formData.horseId}
                      horseName={formData.horseName}
                      horseInfo={formData.horseInfo}
                      onHorseChange={({ horseId, horseName, horseInfo }) =>
                        setFormData((prev) => ({ ...prev, horseId, horseName, horseInfo }))
                      }
                      label="Häst (valfritt)"
                    />

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
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-4">
                      <Link href="/announcements">
                        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isSubmitting}>
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
    </CustomerLayout>
  )
}
