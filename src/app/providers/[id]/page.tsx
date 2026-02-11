"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { useBookingFlow } from "@/hooks/useBookingFlow"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Header } from "@/components/layout/Header"
import { NearbyRoutesBanner, type NearbyRoute } from "@/components/NearbyRoutesBanner"
import { ProviderHours } from "@/components/ProviderHours"
import { UpcomingVisits } from "@/components/UpcomingVisits"
import { ReviewList } from "@/components/review/ReviewList"
import { StarRating } from "@/components/review/StarRating"
import { MobileBookingFlow } from "@/components/booking/MobileBookingFlow"
import { DesktopBookingDialog } from "@/components/booking/DesktopBookingDialog"
import type { CustomerHorse } from "@/hooks/useBookingFlow"

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

interface VerificationImage {
  id: string
  url: string
}

interface Verification {
  id: string
  type: string
  title: string
  description: string | null
  issuer: string | null
  year: number | null
  status: string
  images: VerificationImage[]
}

interface Provider {
  id: string
  businessName: string
  description?: string
  city?: string
  address?: string
  profileImageUrl?: string | null
  acceptingNewCustomers?: boolean
  services: Service[]
  availability: Availability[]
  verifications?: Verification[]
  user: {
    firstName: string
    lastName: string
    phone?: string
  }
}

export default function ProviderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { isAuthenticated, isCustomer } = useAuth()
  const isMobile = useIsMobile()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [customerHorses, setCustomerHorses] = useState<CustomerHorse[]>([])
  const [customerLocation, setCustomerLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [nearbyRoute, setNearbyRoute] = useState<NearbyRoute | null>(null)
  const [reviewSummary, setReviewSummary] = useState<{
    averageRating: number | null
    totalCount: number
  }>({ averageRating: null, totalCount: 0 })
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const booking = useBookingFlow({
    providerId: (params.id as string) || "",
    providerAddress: provider?.address,
    providerCity: provider?.city,
    providerBusinessName: provider?.businessName,
  })

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
        const profileResponse = await fetch("/api/profile")
        if (!profileResponse.ok) return

        const profile = await profileResponse.json()
        if (!profile.latitude || !profile.longitude) return

        const location = {
          latitude: profile.latitude,
          longitude: profile.longitude,
        }
        setCustomerLocation(location)

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

    booking.openBooking(service)
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

  // Shared booking dialog props
  const bookingDialogProps = {
    isOpen: booking.isOpen,
    onOpenChange: (open: boolean) => { if (!open) booking.close() },
    selectedService: booking.selectedService,
    isFlexibleBooking: booking.isFlexibleBooking,
    setIsFlexibleBooking: booking.setIsFlexibleBooking,
    bookingForm: booking.bookingForm,
    setBookingForm: booking.setBookingForm,
    flexibleForm: booking.flexibleForm,
    setFlexibleForm: booking.setFlexibleForm,
    customerHorses,
    providerId: provider.id,
    customerLocation: customerLocation || undefined,
    nearbyRoute,
    canSubmit: booking.canSubmit,
    onSlotSelect: booking.handleSlotSelect,
    onSubmit: booking.handleSubmitBooking,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link
            href="/providers"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6 touch-target"
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
                <div className="flex items-center gap-4">
                  {provider.profileImageUrl && (
                    <img
                      src={provider.profileImageUrl}
                      alt={provider.businessName}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div>
                    <CardTitle className="text-3xl">{provider.businessName}</CardTitle>
                    <CardDescription className="text-lg">
                      {provider.user.firstName} {provider.user.lastName}
                      {provider.city && ` \u2022 ${provider.city}`}
                    </CardDescription>
                  </div>
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
                <p className="text-sm text-gray-600">{provider.address}</p>
              )}
              {provider.user.phone && (
                <p className="text-sm text-gray-600">{provider.user.phone}</p>
              )}
            </CardContent>
          </Card>

          {/* Not accepting new customers banner */}
          {provider.acceptingNewCustomers === false && (
            <Card className="mb-8 border-amber-200 bg-amber-50">
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-amber-800">
                    Denna leverantör tar för närvarande bara emot bokningar från befintliga kunder
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Opening Hours */}
          {provider.availability && provider.availability.length > 0 && (
            <div className="mb-8">
              <ProviderHours availability={provider.availability} />
            </div>
          )}

          {/* Upcoming Visits */}
          <UpcomingVisits providerId={provider.id} />

          {/* Nearby Routes Banner */}
          {isCustomer && provider && customerLocation && (
            <NearbyRoutesBanner
              providerId={provider.id}
              customerLocation={customerLocation}
            />
          )}

          {/* Verifications / Competences */}
          {provider.verifications && provider.verifications.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Kompetenser & Utbildningar</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {provider.verifications.map((ver) => {
                  const typeLabels: Record<string, string> = {
                    education: "Utbildning",
                    organization: "Organisation",
                    certificate: "Certifikat",
                    experience: "Erfarenhet",
                    license: "Licens",
                  }
                  const isApproved = ver.status === "approved"
                  return (
                    <Card key={ver.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <p className="font-semibold">{ver.title}</p>
                            <p className="text-sm text-gray-500">
                              {typeLabels[ver.type] || ver.type}
                              {ver.issuer && ` - ${ver.issuer}`}
                              {ver.year && ` (${ver.year})`}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              isApproved
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {isApproved ? "Verifierad" : "Ej granskad"}
                          </Badge>
                        </div>
                        {ver.description && (
                          <p className="text-sm text-gray-600 mt-2">{ver.description}</p>
                        )}
                        {ver.images && ver.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {ver.images.map((img) => (
                              <img
                                key={img.id}
                                src={img.url}
                                alt="Kompetensbevis"
                                className="w-16 h-16 object-cover rounded cursor-pointer border border-gray-200 hover:opacity-80 transition-opacity"
                                onClick={() => setLightboxImage(img.url)}
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
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

      {/* Image Lightbox */}
      <Dialog open={lightboxImage !== null} onOpenChange={(open) => !open && setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Bild</DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Kompetensbevis"
              className="w-full h-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Booking: Mobile Drawer or Desktop Dialog */}
      {isMobile ? (
        <MobileBookingFlow
          {...bookingDialogProps}
          step={booking.step}
          setStep={booking.setStep}
        />
      ) : (
        <DesktopBookingDialog {...bookingDialogProps} />
      )}
    </div>
  )
}
