"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { toast } from "sonner"

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
      const response = await fetch("/api/bookings")
      if (response.ok) {
        const data = await response.json()
        setBookings(data)
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
      toast.error("Kunde inte hämta bokningar")
    }
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
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
          <Link href="/" className="text-2xl font-bold text-green-800">
            Equinet
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logga ut
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-6">
            <Link
              href="/customer/dashboard"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/customer/bookings"
              className="py-3 border-b-2 border-green-600 text-green-600 font-medium"
            >
              Mina bokningar
            </Link>
            <Link
              href="/providers"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Hitta tjänster
            </Link>
          </div>
        </div>
      </nav>

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
        {filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">
                Inga bokningar att visa för detta filter.
              </p>
              <Link href="/providers">
                <Button>Hitta tjänster</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card key={booking.id}>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
