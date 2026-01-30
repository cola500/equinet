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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { format, addDays } from "date-fns"
import { Header } from "@/components/layout/Header"
import { NearbyRoutesBanner, type NearbyRoute } from "@/components/NearbyRoutesBanner"
import { ProviderHours } from "@/components/ProviderHours"
import { UpcomingVisits } from "@/components/UpcomingVisits"
import { CustomerBookingCalendar } from "@/components/booking/CustomerBookingCalendar"
import { ReviewList } from "@/components/review/ReviewList"
import { StarRating } from "@/components/review/StarRating"

interface Service {
  id: string
  name: string
  description?: string
  price: number
  durationMinutes: number
}

interface Availability {
  dayOfWeek: number
  startTime: string
  endTime: string
  isClosed: boolean
}

interface Provider {
  id: string
  businessName: string
  description?: string
  city?: string
  address?: string
  services: Service[]
  availability: Availability[]
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
  const [isFlexibleBooking, setIsFlexibleBooking] = useState(false)
  const [bookingForm, setBookingForm] = useState({
    bookingDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    startTime: "09:00",
    horseId: "",
    horseName: "",
    horseInfo: "",
    customerNotes: "",
  })
  const [customerHorses, setCustomerHorses] = useState<
    { id: string; name: string; breed: string | null; specialNeeds: string | null }[]
  >([])
  const [flexibleForm, setFlexibleForm] = useState({
    dateFrom: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    dateTo: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    priority: "normal",
    numberOfHorses: 1,
    contactPhone: "",
    specialInstructions: "",
  })
  const [customerLocation, setCustomerLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [nearbyRoute, setNearbyRoute] = useState<NearbyRoute | null>(null)
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number | null
    totalCount: number
  }>({ averageRating: null, totalCount: 0 })

  useEffect(() => {
    if (params.id) {
      fetchProvider()
      fetchReviewSummary()
    }
  }, [params.id])

  const fetchReviewSummary = async () => {
    try {
      const response = await fetch(`/api/providers/${params.id}/reviews?limit=1`)
      if (response.ok) {
        const data = await response.json()
        setReviewSummary({
          averageRating: data.averageRating,
          totalCount: data.totalCount,
        })
      }
    } catch (error) {
      console.error("Error fetching review summary:", error)
    }
  }

  // Fetch customer's horses
  useEffect(() => {
    if (!isCustomer) return
    const fetchHorses = async () => {
      try {
        const response = await fetch("/api/horses")
        if (response.ok) {
          const data = await response.json()
          setCustomerHorses(data)
        }
      } catch (error) {
        console.error("Error fetching horses:", error)
      }
    }
    fetchHorses()
  }, [isCustomer])

  // Fetch customer location and nearby routes for customers
  useEffect(() => {
    if (!isCustomer || !params.id) return

    const fetchLocationAndRoutes = async () => {
      try {
        // First fetch customer location
        const profileResponse = await fetch("/api/profile")
        if (!profileResponse.ok) return

        const profile = await profileResponse.json()
        if (!profile.latitude || !profile.longitude) return

        const location = {
          latitude: profile.latitude,
          longitude: profile.longitude,
        }
        setCustomerLocation(location)

        // Then fetch nearby routes for this provider
        const routeParams = new URLSearchParams({
          providerId: params.id as string,
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          radiusKm: "50",
        })

        const routesResponse = await fetch(
          `/api/route-orders/announcements?${routeParams}`
        )
        if (routesResponse.ok) {
          const routes = await routesResponse.json()
          if (Array.isArray(routes) && routes.length > 0) {
            setNearbyRoute(routes[0])
          }
        }
      } catch (error) {
        console.error("Error fetching location/routes:", error)
      }
    }

    fetchLocationAndRoutes()
  }, [isCustomer, params.id])

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
    // Reset booking form when opening dialog
    setBookingForm({
      bookingDate: "",
      startTime: "",
      horseId: "",
      horseName: "",
      horseInfo: "",
      customerNotes: "",
    })
    setIsBookingDialogOpen(true)
  }

  // Handle slot selection from calendar
  const handleSlotSelect = (date: string, startTime: string, endTime: string) => {
    setBookingForm((prev) => ({
      ...prev,
      bookingDate: date,
      startTime,
    }))
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

    // Validate that user has selected a time slot for fixed booking
    if (!isFlexibleBooking && (!bookingForm.bookingDate || !bookingForm.startTime)) {
      toast.error("Du måste välja en tid i kalendern")
      return
    }

    try {
      if (isFlexibleBooking) {
        // Create RouteOrder for flexible booking
        const response = await fetch("/api/route-orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceType: selectedService.name,
            address: provider.address || `${provider.businessName}, ${provider.city}`,
            latitude: 57.7089, // Default Göteborg coordinates - would be from provider in real app
            longitude: 11.9746,
            numberOfHorses: flexibleForm.numberOfHorses,
            dateFrom: flexibleForm.dateFrom,
            dateTo: flexibleForm.dateTo,
            priority: flexibleForm.priority,
            specialInstructions: flexibleForm.specialInstructions,
            contactPhone: flexibleForm.contactPhone,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to create route order")
        }

        toast.success("Flexibel bokning skapad! Leverantören planerar in dig i sin rutt.")
        setIsBookingDialogOpen(false)
        router.push("/customer/bookings")
      } else {
        // Create regular Booking for fixed time
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
            horseId: bookingForm.horseId || undefined,
            horseName: bookingForm.horseName || undefined,
            horseInfo: bookingForm.horseInfo || undefined,
            customerNotes: bookingForm.customerNotes || undefined,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          // Handle specific conflict error (time slot not available)
          if (response.status === 409) {
            toast.error(data.error || "Tiden är inte tillgänglig")
            return // Don't close dialog so user can pick another time
          }
          throw new Error(data.error || "Failed to create booking")
        }

        toast.success("Bokningsförfrågan skickad!")
        setIsBookingDialogOpen(false)
        router.push("/customer/bookings")
      }
    } catch (error: any) {
      console.error("Error creating booking:", error)
      toast.error(error.message || "Kunde inte skapa bokning")
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
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link
            href="/providers"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
          >
            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tillbaka till leverantörer
          </Link>
          {/* Provider Info */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl">{provider.businessName}</CardTitle>
                  <CardDescription className="text-lg">
                    {provider.user.firstName} {provider.user.lastName}
                    {provider.city && ` • ${provider.city}`}
                  </CardDescription>
                </div>
                {reviewSummary.totalCount > 0 && reviewSummary.averageRating !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <StarRating rating={Math.round(reviewSummary.averageRating)} readonly size="sm" />
                    <span className="font-semibold">{reviewSummary.averageRating.toFixed(1)}</span>
                    <span className="text-gray-500">
                      ({reviewSummary.totalCount})
                    </span>
                  </div>
                )}
              </div>
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

          {/* Opening Hours */}
          {provider.availability && provider.availability.length > 0 && (
            <div className="mb-8">
              <ProviderHours availability={provider.availability} />
            </div>
          )}

          {/* Upcoming Visits - shows planned visits to different areas */}
          <UpcomingVisits providerId={provider.id} />

          {/* Nearby Routes Banner - shown to customers with saved location */}
          {isCustomer && provider && customerLocation && (
            <NearbyRoutesBanner
              providerId={provider.id}
              customerLocation={customerLocation}
            />
          )}

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
                <Card key={service.id} data-testid="service-card">
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
          {/* Reviews Section */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Recensioner</h2>
            <ReviewList providerId={provider.id} />
          </div>
        </div>
      </main>

      {/* Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Boka {selectedService?.name}</DialogTitle>
            <DialogDescription>
              Fyll i dina uppgifter för att skicka en bokningsförfrågan
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            {/* Route Booking Option - shown if provider has nearby route */}
            {nearbyRoute && (
              <div
                className="p-4 rounded-lg border-2 border-green-300 bg-green-50"
                data-testid="route-booking-option"
              >
                <h4 className="font-semibold text-green-800">
                  Boka på planerad rutt
                </h4>
                <p className="text-sm text-green-700 mt-1">
                  Leverantören kommer till ditt område{" "}
                  {new Date(nearbyRoute.dateFrom).toLocaleDateString("sv-SE", {
                    day: "numeric",
                    month: "short",
                  })}
                  {nearbyRoute.dateFrom !== nearbyRoute.dateTo && (
                    <>
                      {" - "}
                      {new Date(nearbyRoute.dateTo).toLocaleDateString("sv-SE", {
                        day: "numeric",
                        month: "short",
                      })}
                    </>
                  )}
                </p>
                <Link href={`/announcements/${nearbyRoute.id}/book`}>
                  <Button
                    type="button"
                    className="w-full mt-3 bg-green-600 hover:bg-green-700"
                  >
                    Boka på rutten
                  </Button>
                </Link>
                <p className="text-xs text-center text-gray-500 mt-2">
                  Eller välj annan tid nedan
                </p>
              </div>
            )}

            {/* Booking Type Toggle */}
            <div className="p-4 rounded-lg border-2 border-blue-300 bg-gray-50 transition-all duration-300" data-testid="booking-type-section">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="booking-type" className="text-base font-medium cursor-pointer">
                    {isFlexibleBooking ? "🔄 Flexibel tid" : "📅 Fast tid"}
                  </Label>
                  <div className="group relative">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Information om bokningstyper"
                    >
                      ℹ️
                    </button>
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
                      <div className="mb-2">
                        <p className="font-semibold text-blue-700">📅 Fast tid:</p>
                        <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                          <li>Du väljer exakt datum och tid</li>
                          <li>Direkt bekräftelse om tillgänglig</li>
                          <li>Passar när du har tight schema</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-purple-700">🔄 Flexibel tid:</p>
                        <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
                          <li>Välj period (flera dagar)</li>
                          <li>Leverantören planerar optimal tid</li>
                          <li>Passar när du är flexibel</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <Switch
                  id="booking-type"
                  data-testid="booking-type-toggle"
                  checked={isFlexibleBooking}
                  onCheckedChange={setIsFlexibleBooking}
                  className={`${
                    isFlexibleBooking
                      ? 'data-[state=checked]:bg-purple-700 shadow-md'
                      : 'data-[state=unchecked]:bg-blue-600 shadow-md'
                  }`}
                />
              </div>
              <p className="text-sm text-gray-700">
                {isFlexibleBooking
                  ? "Välj ett datumspann (t.ex. '1-5 januari') så planerar leverantören in dig i sin rutt"
                  : "Du väljer exakt datum och tid (t.ex. 'Fredag 15 nov kl 14:00')"
                }
              </p>
            </div>

            {/* Fixed Time Booking Fields */}
            {!isFlexibleBooking && selectedService && (
              <>
                {/* Calendar for time selection */}
                <div className="space-y-2">
                  <Label>Välj tid *</Label>
                  <CustomerBookingCalendar
                    providerId={provider.id}
                    serviceDurationMinutes={selectedService.durationMinutes}
                    onSlotSelect={handleSlotSelect}
                    customerLocation={customerLocation || undefined}
                  />
                  {bookingForm.bookingDate && bookingForm.startTime && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        <span className="font-semibold">Vald tid:</span>{" "}
                        {new Date(bookingForm.bookingDate).toLocaleDateString("sv-SE", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}{" "}
                        kl. {bookingForm.startTime}
                        <span className="text-gray-600 ml-1">
                          ({selectedService.durationMinutes} min)
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Horse selection */}
                <div className="space-y-2">
                  <Label htmlFor="horse-select">Häst</Label>
                  {customerHorses.length > 0 ? (
                    <>
                      <Select
                        value={bookingForm.horseId}
                        onValueChange={(value) => {
                          if (value === "__manual__") {
                            setBookingForm({
                              ...bookingForm,
                              horseId: "",
                              horseName: "",
                              horseInfo: "",
                            })
                          } else {
                            const horse = customerHorses.find((h) => h.id === value)
                            setBookingForm({
                              ...bookingForm,
                              horseId: value,
                              horseName: horse?.name || "",
                              horseInfo: horse?.specialNeeds || "",
                            })
                          }
                        }}
                      >
                        <SelectTrigger id="horse-select">
                          <SelectValue placeholder="Välj häst..." />
                        </SelectTrigger>
                        <SelectContent>
                          {customerHorses.map((horse) => (
                            <SelectItem key={horse.id} value={horse.id}>
                              {horse.name}
                              {horse.breed && ` (${horse.breed})`}
                            </SelectItem>
                          ))}
                          <SelectItem value="__manual__">
                            Annan häst (ange manuellt)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {bookingForm.horseId && bookingForm.horseId !== "__manual__" && bookingForm.horseInfo && (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                          {bookingForm.horseInfo}
                        </p>
                      )}
                    </>
                  ) : (
                    <Input
                      id="horseName"
                      value={bookingForm.horseName}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, horseName: e.target.value })
                      }
                      placeholder="Hästens namn"
                    />
                  )}
                  {/* Manual horse name input when "Annan häst" is selected */}
                  {customerHorses.length > 0 && !bookingForm.horseId && (
                    <Input
                      id="horseName-manual"
                      value={bookingForm.horseName}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, horseName: e.target.value })
                      }
                      placeholder="Hästens namn"
                    />
                  )}
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
              </>
            )}

            {/* Flexible Booking Fields */}
            {isFlexibleBooking && (
              <div data-testid="flexible-booking-section">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">Från datum *</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={flexibleForm.dateFrom}
                    onChange={(e) =>
                      setFlexibleForm({ ...flexibleForm, dateFrom: e.target.value })
                    }
                    min={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateTo">Till datum *</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={flexibleForm.dateTo}
                    onChange={(e) =>
                      setFlexibleForm({ ...flexibleForm, dateTo: e.target.value })
                    }
                    min={flexibleForm.dateFrom}
                    required
                  />
                  <p className="text-xs text-gray-600">
                    Leverantören kan besöka dig när som helst under denna period
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Prioritet *</Label>
                  <RadioGroup
                    value={flexibleForm.priority}
                    onValueChange={(value) =>
                      setFlexibleForm({ ...flexibleForm, priority: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="normal" id="priority-normal" data-testid="priority-normal" />
                      <Label htmlFor="priority-normal" className="font-normal cursor-pointer">
                        Normal - Inom den valda perioden
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="urgent" id="priority-urgent" data-testid="priority-urgent" />
                      <Label htmlFor="priority-urgent" className="font-normal cursor-pointer">
                        Akut - Inom 48 timmar
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numberOfHorses">Antal hästar *</Label>
                  <Input
                    id="numberOfHorses"
                    type="number"
                    min="1"
                    value={flexibleForm.numberOfHorses}
                    onChange={(e) =>
                      setFlexibleForm({ ...flexibleForm, numberOfHorses: parseInt(e.target.value) || 1 })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Kontakttelefon *</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={flexibleForm.contactPhone}
                    onChange={(e) =>
                      setFlexibleForm({ ...flexibleForm, contactPhone: e.target.value })
                    }
                    placeholder="070-123 45 67"
                    required
                  />
                  <p className="text-xs text-gray-600">
                    Leverantören kontaktar dig på detta nummer för att bekräfta tid
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialInstructions">Särskilda instruktioner</Label>
                  <Textarea
                    id="specialInstructions"
                    value={flexibleForm.specialInstructions}
                    onChange={(e) =>
                      setFlexibleForm({ ...flexibleForm, specialInstructions: e.target.value })
                    }
                    rows={2}
                    placeholder="T.ex. portkod, parkering, hästens behov..."
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBookingDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={!isFlexibleBooking && (!bookingForm.bookingDate || !bookingForm.startTime)}
              >
                Skicka bokningsförfrågan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
