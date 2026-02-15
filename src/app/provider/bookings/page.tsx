"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useBookings as useSWRBookings } from "@/hooks/useBookings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { Label } from "@/components/ui/label"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { CustomerReviewDialog } from "@/components/review/CustomerReviewDialog"
import { StarRating } from "@/components/review/StarRating"
import { QuickNoteButton } from "@/components/booking/QuickNoteButton"
import { Mic } from "lucide-react"
import { sortBookings, filterBookings, countByStatus, type BookingFilter } from "./booking-utils"

interface Payment {
  id: string
  status: string
  amount: number
  currency: string
  paidAt: string | null
  invoiceNumber: string | null
}

interface Horse {
  id: string
  name: string
  breed?: string | null
  gender?: string | null
}

interface Booking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  horse?: Horse | null
  service: {
    name: string
    price: number
  }
  customer: {
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  payment?: Payment | null
  customerReview?: {
    id: string
    rating: number
    comment: string | null
  } | null
}

export default function ProviderBookingsPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const { bookings: rawBookings, mutate: mutateBookings } = useSWRBookings()
  const bookings = rawBookings as unknown as Booking[]
  const [filter, setFilter] = useState<BookingFilter>("all")
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null)
  const [cancellationMessage, setCancellationMessage] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error("Failed to update booking")
      }

      toast.success("Bokning uppdaterad!")
      mutateBookings()

      // Stay on current filter -- booking moves within the list naturally
    } catch (error) {
      console.error("Error updating booking:", error)
      toast.error("Kunde inte uppdatera bokning")
    }
  }

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return

    setIsCancelling(true)
    try {
      const body: { status: string; cancellationMessage?: string } = { status: "cancelled" }
      if (cancellationMessage.trim()) {
        body.cancellationMessage = cancellationMessage.trim()
      }

      const response = await fetch(`/api/bookings/${bookingToCancel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel booking")
      }

      toast.success("Bokningen har avbokats")
      setBookingToCancel(null)
      setCancellationMessage("")
      mutateBookings()
    } catch (error) {
      console.error("Error cancelling booking:", error)
      toast.error("Kunde inte avboka bokningen")
    } finally {
      setIsCancelling(false)
    }
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

  const filteredBookings = sortBookings(filterBookings(bookings, filter), filter)
  const counts = countByStatus(bookings)

  const getStatusBadge = (booking: Booking) => {
    const isPaid = booking.payment?.status === "succeeded"

    // Om betald, visa alltid "Betald" oavsett bokningsstatus
    if (isPaid) {
      return (
        <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">
          Betald
        </span>
      )
    }

    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800",
    }

    const labels = {
      pending: "Väntar på svar",
      confirmed: "Bekräftad",
      cancelled: "Avbokad",
      completed: "Genomförd",
    }

    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[booking.status as keyof typeof styles]}`}>
        {labels[booking.status as keyof typeof labels] || booking.status}
      </span>
    )
  }

  return (
    <ProviderLayout>
      <div className="mb-6 md:mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Bokningar</h1>
            <p className="text-gray-600 mt-1">Hantera dina kundbokningar</p>
          </div>
          <Button
            onClick={() => router.push("/provider/voice-log")}
            variant="outline"
            className="gap-2"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Röstlogg</span>
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 md:gap-3 mb-6">
          {([
            { key: "all", label: "Alla" },
            { key: "pending", label: "Väntar" },
            { key: "confirmed", label: "Bekräftade" },
            { key: "completed", label: "Genomförda" },
            { key: "cancelled", label: "Avbokade" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base touch-target ${
                filter === key
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">
                Inga bokningar att visa för detta filter.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card key={booking.id} data-testid="booking-item">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{booking.service.name}</CardTitle>
                      <CardDescription>
                        {booking.customer.firstName} {booking.customer.lastName}
                      </CardDescription>
                    </div>
                    {getStatusBadge(booking)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-gray-700">
                        Bokningsdetaljer
                      </h3>
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
                      <div className="text-sm">
                        <span className="text-gray-600">Pris:</span>{" "}
                        <span className="font-medium">{booking.service.price} kr</span>
                      </div>
                      {booking.payment?.status === "succeeded" && (
                        <div className="text-sm">
                          <span className="text-gray-600">Kvitto:</span>{" "}
                          <span className="font-medium">{booking.payment.invoiceNumber}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-gray-700">
                        Kundinformation
                      </h3>
                      <div className="text-sm">
                        <span className="text-gray-600">Email:</span>{" "}
                        <span className="font-medium">{booking.customer.email}</span>
                      </div>
                      {booking.customer.phone && (
                        <div className="text-sm">
                          <span className="text-gray-600">Telefon:</span>{" "}
                          <span className="font-medium">{booking.customer.phone}</span>
                        </div>
                      )}
                      {booking.horseInfo && (
                        <div className="text-sm">
                          <span className="text-gray-600">Hästinfo:</span>{" "}
                          <p className="text-gray-800 mt-1">{booking.horseInfo}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {booking.customerNotes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">
                        <strong>Kundkommentarer:</strong> {booking.customerNotes}
                      </p>
                    </div>
                  )}

                  {booking.status === "pending" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <Button
                        onClick={() => updateBookingStatus(booking.id, "confirmed")}
                        className="flex-1"
                      >
                        Acceptera
                      </Button>
                      <Button
                        onClick={() => {
                          setBookingToCancel(booking.id)
                          setCancellationMessage("")
                        }}
                        variant="destructive"
                        className="flex-1"
                      >
                        Avböj
                      </Button>
                    </div>
                  )}

                  {booking.status === "confirmed" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <Button
                        onClick={() => updateBookingStatus(booking.id, "completed")}
                        className="flex-1"
                      >
                        Markera som genomförd
                      </Button>
                      <QuickNoteButton
                        bookingId={booking.id}
                        variant="inline"
                        onNoteSaved={() => mutateBookings()}
                      />
                      <Button
                        onClick={() => {
                          setBookingToCancel(booking.id)
                          setCancellationMessage("")
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Avboka
                      </Button>
                    </div>
                  )}

                  {booking.status === "completed" && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {booking.customerReview ? (
                          <>
                            <span className="text-sm text-gray-600">Din recension:</span>
                            <StarRating rating={booking.customerReview.rating} readonly size="sm" />
                            {booking.customerReview.comment && (
                              <span className="text-sm text-gray-500 truncate max-w-[200px]">
                                - {booking.customerReview.comment}
                              </span>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReviewBooking(booking)}
                          >
                            Recensera kund
                          </Button>
                        )}
                      </div>
                      <QuickNoteButton
                        bookingId={booking.id}
                        variant="icon"
                        onNoteSaved={() => mutateBookings()}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!bookingToCancel} onOpenChange={() => { setBookingToCancel(null); setCancellationMessage("") }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avboka bokning?</AlertDialogTitle>
            <AlertDialogDescription>
              Kunden kommer att meddelas om avbokningen. Du kan skicka ett valfritt meddelande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="cancellation-message">Meddelande till kund (valfritt)</Label>
            <VoiceTextarea
              id="cancellation-message"
              placeholder="T.ex. anledning till avbokningen..."
              value={cancellationMessage}
              onChange={(value) => setCancellationMessage(value)}
              maxLength={500}
              className="mt-1.5"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">{cancellationMessage.length}/500</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? "Avbokar..." : "Ja, avboka"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile FAB for voice log */}
      <button
        onClick={() => router.push("/provider/voice-log")}
        className="fixed bottom-20 right-4 md:hidden h-14 w-14 rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors z-40"
        aria-label="Öppna röstloggning"
      >
        <Mic className="w-6 h-6" />
      </button>

      {/* Customer Review Dialog */}
      {reviewBooking && (
        <CustomerReviewDialog
          open={!!reviewBooking}
          onOpenChange={(open) => { if (!open) setReviewBooking(null) }}
          bookingId={reviewBooking.id}
          customerName={`${reviewBooking.customer.firstName} ${reviewBooking.customer.lastName}`}
          serviceName={reviewBooking.service.name}
          onSuccess={() => {
            setReviewBooking(null)
            mutateBookings()
          }}
        />
      )}
    </ProviderLayout>
  )
}
