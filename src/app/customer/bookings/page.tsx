"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { toast } from "sonner"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { Badge } from "@/components/ui/badge"
import { ReviewDialog } from "@/components/review/ReviewDialog"
import { StarRating } from "@/components/review/StarRating"
import { BookingCardSkeleton } from "@/components/loading/BookingCardSkeleton"
import { CustomerOnboardingChecklist } from "@/components/customer/CustomerOnboardingChecklist"

interface Payment {
  id: string
  status: string
  amount: number
  currency: string
  paidAt: string | null
  invoiceNumber: string | null
  invoiceUrl: string | null
}

interface Booking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  cancellationMessage?: string
  horseName?: string
  horse?: {
    id: string
    name: string
    breed?: string | null
    gender?: string | null
  } | null
  customerNotes?: string
  service: {
    name: string
    price: number
    durationMinutes: number
  }
  provider: {
    businessName: string
    user: {
      firstName: string
      lastName: string
    }
  }
  payment?: Payment | null
  review?: {
    id: string
    rating: number
    comment: string | null
    reply: string | null
    repliedAt: string | null
  } | null
  type: "fixed"
}

interface RouteOrder {
  id: string
  serviceType: string
  address: string
  numberOfHorses: number
  dateFrom: string
  dateTo: string
  priority: string
  specialInstructions?: string
  status: string
  createdAt: string
  routeStops?: Array<{
    route: {
      routeName: string
      routeDate: string
      provider: {
        businessName: string
        user: {
          firstName: string
          lastName: string
        }
      }
    }
    estimatedArrival?: string
  }>
  type: "flexible"
}

type CombinedBooking = Booking | RouteOrder

export default function CustomerBookingsPage() {
  const router = useRouter()
  const { isLoading, isCustomer } = useAuth()
  const { data: regularBookings, error: bookingsError, isLoading: isLoadingSWRBookings, mutate: mutateBookings } =
    useSWR<Booking[]>(isCustomer ? "/api/bookings" : null)
  const { data: routeOrders, error: routeOrdersError, isLoading: isLoadingRouteOrders, mutate: mutateRouteOrders } =
    useSWR<RouteOrder[]>(isCustomer ? "/api/route-orders/my-orders" : null)

  const isLoadingBookings = isLoadingSWRBookings || isLoadingRouteOrders
  const error = (bookingsError && routeOrdersError)
    ? "Kunde inte hämta bokningar"
    : null

  const bookings: CombinedBooking[] = [
    ...(regularBookings ?? []).map(b => ({ ...b, type: "fixed" as const })),
    ...(routeOrders ?? []).map(r => ({ ...r, type: "flexible" as const })),
  ]

  const mutateAll = () => { mutateBookings(); mutateRouteOrders() }

  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming")
  const [bookingToCancel, setBookingToCancel] = useState<{ id: string; type: "fixed" | "flexible" } | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null)
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, isLoading, router])

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return

    setIsCancelling(true)
    try {
      let response: Response

      if (bookingToCancel.type === "flexible") {
        // Route orders use a different API endpoint
        response = await fetch(`/api/route-orders/${bookingToCancel.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        })
      } else {
        response = await fetch(`/api/bookings/${bookingToCancel.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        })
      }

      if (!response.ok) {
        throw new Error("Failed to cancel booking")
      }

      toast.success("Bokningen har avbokats")
      setBookingToCancel(null)
      mutateAll() // Refresh the list
    } catch (error) {
      console.error("Error cancelling booking:", error)
      toast.error("Kunde inte avboka bokningen")
    } finally {
      setIsCancelling(false)
    }
  }

  const handlePayment = async (bookingId: string) => {
    setPayingBookingId(bookingId)
    try {
      const response = await fetch(`/api/bookings/${bookingId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Betalningen misslyckades")
      }

      toast.success("Betalning genomförd!")
      mutateAll() // Refresh the list
    } catch (error) {
      console.error("Error processing payment:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte genomföra betalningen")
    } finally {
      setPayingBookingId(null)
    }
  }

  const handleDeleteReview = async (reviewId: string) => {
    setDeletingReviewId(reviewId)
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error("Failed to delete review")
      }
      toast.success("Recension borttagen")
      mutateAll()
    } catch (error) {
      console.error("Error deleting review:", error)
      toast.error("Kunde inte ta bort recensionen")
    } finally {
      setDeletingReviewId(null)
    }
  }

  if (isLoading || !isCustomer) {
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

  const now = new Date()
  const filteredBookings = bookings.filter((booking) => {
    if (booking.type === "fixed") {
      const bookingDate = new Date(booking.bookingDate)
      if (filter === "upcoming") {
        return bookingDate >= now && (booking.status === "pending" || booking.status === "confirmed")
      } else if (filter === "past") {
        return bookingDate < now || booking.status === "completed" || booking.status === "cancelled"
      }
    } else {
      // Flexible booking (RouteOrder)
      const dateTo = new Date(booking.dateTo)
      if (filter === "upcoming") {
        return dateTo >= now && (booking.status === "pending" || booking.status === "in_route")
      } else if (filter === "past") {
        return dateTo < now || booking.status === "completed" || booking.status === "cancelled"
      }
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800",
      no_show: "bg-orange-100 text-orange-800",
      in_route: "bg-purple-100 text-purple-800",
    }

    const labels: Record<string, string> = {
      pending: "Väntar på svar",
      confirmed: "Bekräftad",
      cancelled: "Avbokad",
      completed: "Genomförd",
      no_show: "Ej infunnit",
      in_route: "Inplanerad i rutt",
    }

    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {labels[status] || status}
      </span>
    )
  }

  const getStatusBorderClass = (status: string): string => {
    const borders: Record<string, string> = {
      pending: "border-l-4 border-l-yellow-400",
      confirmed: "border-l-4 border-l-green-500",
      cancelled: "border-l-4 border-l-red-400",
      completed: "border-l-4 border-l-blue-400",
      no_show: "border-l-4 border-l-orange-400",
      in_route: "border-l-4 border-l-purple-500",
    }
    return borders[status] || ""
  }

  return (
    <CustomerLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mina bokningar</h1>
          <p className="text-gray-600 mt-1">Hantera dina bokningar</p>
        </div>
        <Link href="/providers">
          <Button className="w-full sm:w-auto">Boka ny tjänst</Button>
        </Link>
      </div>

        {/* Onboarding Checklist for new customers */}
        <div className="mb-8">
          <CustomerOnboardingChecklist />
        </div>

        {/* Filter Tabs -- segment control style */}
        <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-6">
          {(["upcoming", "past", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 touch-target rounded-md text-sm font-medium transition-all duration-200 ${
                filter === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "upcoming" ? "Kommande" : tab === "past" ? "Tidigare" : "Alla"}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Något gick fel
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => mutateAll()}>Försök igen</Button>
            </CardContent>
          </Card>
        ) : isLoadingBookings ? (
          <BookingCardSkeleton count={3} />
        ) : filteredBookings.length === 0 ? (
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {filter === "upcoming" && "Inga kommande bokningar"}
                {filter === "past" && "Inga tidigare bokningar"}
                {filter === "all" && "Inga bokningar ännu"}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {bookings.length === 0 ? (
                  <>
                    Börja med att hitta en tjänsteleverantör och gör din första bokning.
                    Utforska vårt utbud av hovslagare, veterinärer och andra hästtjänster.
                  </>
                ) : (
                  "Byt filter för att se andra bokningar."
                )}
              </p>
              {bookings.length === 0 && (
                <Link href="/providers">
                  <Button size="lg">
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    Hitta tjänster
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking, index) => (
              <Card key={booking.id} data-testid="booking-item" className={`animate-fade-in-up ${getStatusBorderClass(booking.status)}`} style={{ animationDelay: `${index * 50}ms` }}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {booking.type === "fixed" ? (
                        <div>
                          <CardTitle>{booking.service.name}</CardTitle>
                          <CardDescription>
                            {booking.provider.businessName}
                          </CardDescription>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{booking.serviceType}</CardTitle>
                            <Badge variant="outline" data-testid="booking-type-badge">Flexibel tid</Badge>
                          </div>
                          {booking.routeStops && booking.routeStops.length > 0 ? (
                            <CardDescription>
                              {booking.routeStops[0].route.provider.businessName}
                            </CardDescription>
                          ) : (
                            <CardDescription>
                              Väntar på ruttplanering
                            </CardDescription>
                          )}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {booking.type === "fixed" ? (
                    // Fixed time booking display
                    <>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-gray-600">Datum:</span>{" "}
                            <span className="font-medium">
                              {format(new Date(booking.bookingDate), "d MMMM yyyy", {
                                locale: sv,
                              })}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Tid:</span>{" "}
                            <span className="font-medium">
                              {booking.startTime} - {booking.endTime}
                            </span>
                          </div>
                          {(booking.horse || booking.horseName) && (
                            <div className="text-sm">
                              <span className="text-gray-600">Häst:</span>{" "}
                              <span className="font-medium">
                                {booking.horse?.name || booking.horseName}
                              </span>
                              {booking.horse?.breed && (
                                <span className="text-gray-500 ml-1">
                                  ({booking.horse.breed})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-gray-600">Pris:</span>{" "}
                            <span className="font-medium">{booking.service.price} kr</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Varaktighet:</span>{" "}
                            <span className="font-medium">
                              {booking.service.durationMinutes} min
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Kontakt:</span>{" "}
                            <span className="font-medium">
                              {booking.provider.user.firstName}{" "}
                              {booking.provider.user.lastName}
                            </span>
                          </div>
                        </div>
                      </div>
                      {booking.customerNotes && (
                        <div className="mt-4 p-3 bg-gray-50 rounded">
                          <p className="text-sm text-gray-600">
                            <strong>Dina kommentarer:</strong> {booking.customerNotes}
                          </p>
                        </div>
                      )}
                      {booking.status === "cancelled" && booking.cancellationMessage && (
                        <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
                          <p className="text-sm text-red-800">
                            <strong>Meddelande vid avbokning:</strong> {booking.cancellationMessage}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    // Flexible booking display
                    <>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-sm" data-testid="booking-period">
                            <span className="text-gray-600">Period:</span>{" "}
                            <span className="font-medium">
                              {format(new Date(booking.dateFrom), "d MMM", { locale: sv })} - {format(new Date(booking.dateTo), "d MMM yyyy", { locale: sv })}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Prioritet:</span>{" "}
                            <Badge variant={booking.priority === "urgent" ? "destructive" : "secondary"}>
                              {booking.priority === "urgent" ? "Akut" : "Normal"}
                            </Badge>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Antal hästar:</span>{" "}
                            <span className="font-medium">{booking.numberOfHorses}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-gray-600">Adress:</span>{" "}
                            <span className="font-medium">{booking.address}</span>
                          </div>
                          {booking.routeStops && booking.routeStops.length > 0 && booking.routeStops[0].estimatedArrival && (
                            <div className="text-sm">
                              <span className="text-gray-600">Beräknad ankomst:</span>{" "}
                              <span className="font-medium">
                                {format(new Date(booking.routeStops[0].estimatedArrival), "d MMM HH:mm", { locale: sv })}
                              </span>
                            </div>
                          )}
                          {booking.routeStops && booking.routeStops.length > 0 && (
                            <div className="text-sm">
                              <span className="text-gray-600">Rutt:</span>{" "}
                              <span className="font-medium">{booking.routeStops[0].route.routeName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {booking.specialInstructions && (
                        <div className="mt-4 p-3 bg-gray-50 rounded">
                          <p className="text-sm text-gray-600">
                            <strong>Instruktioner:</strong> {booking.specialInstructions}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Payment and action buttons for fixed bookings */}
                  {booking.type === "fixed" && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                        {/* Payment status and actions */}
                        {booking.payment?.status === "succeeded" ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">
                              Betald
                            </Badge>
                            {booking.payment.invoiceNumber && (
                              <span className="text-sm text-gray-500">
                                Kvitto: {booking.payment.invoiceNumber}
                              </span>
                            )}
                            {booking.payment.invoiceUrl && (
                              <a
                                href={booking.payment.invoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Ladda ner kvitto
                              </a>
                            )}
                          </div>
                        ) : (booking.status === "confirmed" || booking.status === "completed") ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                            onClick={() => handlePayment(booking.id)}
                            disabled={payingBookingId === booking.id}
                          >
                            {payingBookingId === booking.id ? (
                              <>
                                <span className="animate-spin mr-2">...</span>
                                Bearbetar...
                              </>
                            ) : (
                              <>Betala {booking.service.price} kr</>
                            )}
                          </Button>
                        ) : null}

                        {/* Cancel button - only show for pending/confirmed bookings that are not paid */}
                        {(booking.status === "pending" || booking.status === "confirmed") &&
                          booking.payment?.status !== "succeeded" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                            onClick={() => setBookingToCancel({ id: booking.id, type: "fixed" })}
                          >
                            Avboka
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review section for completed fixed bookings */}
                  {booking.type === "fixed" && booking.status === "completed" && (
                    <div className="mt-3 pt-3 border-t">
                      {booking.review ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">Din recension:</span>
                              <StarRating rating={booking.review.rating} readonly size="sm" />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] sm:min-h-0 sm:h-7 px-2 text-gray-500"
                                onClick={() => setReviewBooking(booking)}
                              >
                                Redigera
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] sm:min-h-0 sm:h-7 px-2 text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteReview(booking.review!.id)}
                                disabled={deletingReviewId === booking.review.id}
                              >
                                {deletingReviewId === booking.review.id ? "..." : "Ta bort"}
                              </Button>
                            </div>
                          </div>
                          {booking.review.comment && (
                            <p className="text-sm text-gray-600 italic">
                              "{booking.review.comment}"
                            </p>
                          )}
                          {booking.review.reply && (
                            <div className="mt-2 pl-3 border-l-2 border-green-300 bg-green-50 p-2 rounded-r">
                              <p className="text-xs font-medium text-green-800 mb-1">Svar från leverantören</p>
                              <p className="text-sm text-green-700">{booking.review.reply}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                          onClick={() => setReviewBooking(booking)}
                        >
                          Lämna recension
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Cancel button for flexible bookings */}
                  {booking.type === "flexible" && (booking.status === "pending" || booking.status === "in_route") && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                        onClick={() => setBookingToCancel({ id: booking.id, type: "flexible" })}
                      >
                        Avboka denna bokning
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      {/* Review Dialog */}
      {reviewBooking && (
        <ReviewDialog
          open={!!reviewBooking}
          onOpenChange={(open) => { if (!open) setReviewBooking(null) }}
          bookingId={reviewBooking.id}
          serviceName={reviewBooking.service.name}
          providerName={reviewBooking.provider.businessName}
          existingReview={reviewBooking.review || undefined}
          onSuccess={() => {
            setReviewBooking(null)
            mutateAll()
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      {bookingToCancel && (
        <ResponsiveAlertDialog open={true} onOpenChange={() => setBookingToCancel(null)}>
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Avboka bokning?</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                Är du säker på att du vill avboka denna bokning? Leverantören kommer att meddelas om avbokningen.
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel disabled={isCancelling} onClick={() => setBookingToCancel(null)}>
                Nej, behåll bokningen
              </ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="bg-red-600 hover:bg-red-700"
              >
                {isCancelling ? "Avbokar..." : "Ja, avboka"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}
    </CustomerLayout>
  )
}
