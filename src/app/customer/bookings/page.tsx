"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
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
}

export default function CustomerBookingsPage() {
  const router = useRouter()
  const { user, isLoading, isCustomer } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming")
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
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
      const response = await fetch("/api/bookings")
      if (response.ok) {
        const data = await response.json()
        setBookings(data)
      } else {
        setError("Kunde inte hämta bokningar")
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingBookings(false)
    }
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
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
    const bookingDate = new Date(booking.bookingDate)
    if (filter === "upcoming") {
      return bookingDate >= now && (booking.status === "pending" || booking.status === "confirmed")
    } else if (filter === "past") {
      return bookingDate < now || booking.status === "completed" || booking.status === "cancelled"
    }
    return true
  })

  const getStatusBadge = (status: string) => {
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
      <span className={`text-xs px-2 py-1 rounded ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/providers" className="text-2xl font-bold text-green-800">
            Equinet
          </Link>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-sm">
                  {user?.name}
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <Link href="/customer/bookings">
                  <DropdownMenuItem className="cursor-pointer">
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Mina bokningar
                  </DropdownMenuItem>
                </Link>
                <Link href="/customer/profile">
                  <DropdownMenuItem className="cursor-pointer">
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Min profil
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600"
                  onClick={handleLogout}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logga ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
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
                    <div>
                      <CardTitle>{booking.service.name}</CardTitle>
                      <CardDescription>
                        {booking.provider.businessName}
                      </CardDescription>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>
                </CardHeader>
                <CardContent>
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

                  {/* Cancel button - only show for pending/confirmed bookings */}
                  {(booking.status === "pending" || booking.status === "confirmed") && (
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
      </main>

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
    </div>
  )
}
