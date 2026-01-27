"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
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
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { Badge } from "@/components/ui/badge"

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
  horseName?: string
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
  const [bookings, setBookings] = useState<CombinedBooking[]>([])
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming")
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingBookings, setIsLoadingBookings] = useState(true)

  useEffect(() => {
    if (!isLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, isLoading, router])

  useEffect(() => {
    if (isCustomer) {
      fetchBookings()
    }
  }, [isCustomer])

  const fetchBookings = async () => {
    try {
      setIsLoadingBookings(true)
      setError(null)

      // Fetch both regular bookings and route orders
      const [bookingsRes, routeOrdersRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/route-orders/my-orders")
      ])

      if (!bookingsRes.ok && !routeOrdersRes.ok) {
        setError("Kunde inte hämta bokningar")
        return
      }

      const regularBookings: Booking[] = bookingsRes.ok ? await bookingsRes.json() : []
      const routeOrders: RouteOrder[] = routeOrdersRes.ok ? await routeOrdersRes.json() : []

      // Add type field to distinguish between booking types
      const combinedBookings: CombinedBooking[] = [
        ...regularBookings.map(b => ({ ...b, type: "fixed" as const })),
        ...routeOrders.map(r => ({ ...r, type: "flexible" as const }))
      ]

      setBookings(combinedBookings)
    } catch (error) {
      console.error("Error fetching bookings:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingBookings(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return

    setIsCancelling(true)
    try {
      const response = await fetch(`/api/bookings/${bookingToCancel}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel booking")
      }

      toast.success("Bokningen har avbokats")
      setBookingToCancel(null)
      fetchBookings() // Refresh the list
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
      fetchBookings() // Refresh the list
    } catch (error) {
      console.error("Error processing payment:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte genomföra betalningen")
    } finally {
      setPayingBookingId(null)
    }
  }

  if (isLoading || !isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
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
      in_route: "bg-purple-100 text-purple-800",
    }

    const labels: Record<string, string> = {
      pending: "Väntar på svar",
      confirmed: "Bekräftad",
      cancelled: "Avbokad",
      completed: "Genomförd",
      in_route: "Inplanerad i rutt",
    }

    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <CustomerLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mina bokningar</h1>
          <p className="text-gray-600 mt-1">Hantera dina bokningar</p>
        </div>
        <Link href="/providers">
          <Button>Boka ny tjänst</Button>
        </Link>
      </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter("upcoming")}
            className={`px-4 py-2 rounded-lg ${
              filter === "upcoming"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Kommande
          </button>
          <button
            onClick={() => setFilter("past")}
            className={`px-4 py-2 rounded-lg ${
              filter === "past"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Tidigare
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg ${
              filter === "all"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Alla
          </button>
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
              <Button onClick={fetchBookings}>Försök igen</Button>
            </CardContent>
          </Card>
        ) : isLoadingBookings ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar bokningar...</p>
          </div>
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
            {filteredBookings.map((booking) => (
              <Card key={booking.id} data-testid="booking-item">
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
                          {booking.horseName && (
                            <div className="text-sm">
                              <span className="text-gray-600">Häst:</span>{" "}
                              <span className="font-medium">{booking.horseName}</span>
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
                      <div className="flex flex-wrap items-center gap-3">
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
                            onClick={() => setBookingToCancel(booking.id)}
                          >
                            Avboka
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cancel button for flexible bookings */}
                  {booking.type === "flexible" && (booking.status === "pending" || booking.status === "in_route") && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setBookingToCancel(booking.id)}
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!bookingToCancel} onOpenChange={() => setBookingToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avboka bokning?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill avboka denna bokning? Leverantören kommer att meddelas om avbokningen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Nej, behåll bokningen
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
    </CustomerLayout>
  )
}
