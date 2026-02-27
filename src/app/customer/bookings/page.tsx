"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { ReviewDialog } from "@/components/review/ReviewDialog"
import { BookingCardSkeleton } from "@/components/loading/BookingCardSkeleton"
import { FirstUseTooltip } from "@/components/ui/first-use-tooltip"
import { CustomerOnboardingChecklist } from "@/components/customer/CustomerOnboardingChecklist"
import { RescheduleDialog } from "@/components/booking/RescheduleDialog"
import { BookingCard } from "@/components/customer/bookings/BookingCard"
import { useBookingFilters, type BookingFilter } from "@/hooks/useBookingFilters"
import type { Booking, RouteOrder, CombinedBooking } from "@/components/customer/bookings/types"

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

  const { filter, setFilter, filteredBookings } = useBookingFilters(bookings)
  const [bookingToCancel, setBookingToCancel] = useState<{ id: string; type: "fixed" | "flexible" } | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null)
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null)
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null)
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
        response = await fetch(`/api/route-orders/${bookingToCancel.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        })
      } else {
        response = await fetch(`/api/bookings/${bookingToCancel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        })
      }

      if (!response.ok) {
        throw new Error("Failed to cancel booking")
      }

      toast.success("Bokningen har avbokats")
      setBookingToCancel(null)
      mutateAll()
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
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Betalningen misslyckades")
      }

      toast.success("Betalning genomförd!")
      mutateAll()
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
        <BookingCardSkeleton />
      </CustomerLayout>
    )
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
              onClick={() => setFilter(tab as BookingFilter)}
              aria-pressed={filter === tab}
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
          <FirstUseTooltip
            id="customer-bookings"
            title="Dina bokningar"
            description="Här ser du alla dina bokningar. Klicka på en för mer detaljer."
          >
          <div className="space-y-4">
            {filteredBookings.map((booking, index) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                index={index}
                payingBookingId={payingBookingId}
                deletingReviewId={deletingReviewId}
                onPayment={handlePayment}
                onCancel={(id, type) => setBookingToCancel({ id, type })}
                onReview={(b) => setReviewBooking(b)}
                onReschedule={(b) => setRescheduleBooking(b)}
                onDeleteReview={handleDeleteReview}
              />
            ))}
          </div>
          </FirstUseTooltip>
        )}

      {/* Reschedule Dialog */}
      {rescheduleBooking && (
        <RescheduleDialog
          booking={rescheduleBooking}
          open={!!rescheduleBooking}
          onOpenChange={(open) => { if (!open) setRescheduleBooking(null) }}
          onSuccess={() => {
            setRescheduleBooking(null)
            mutateAll()
          }}
        />
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
