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

interface Booking {
  id: string
  bookingDate: string
  startTime: string
  status: string
  service: {
    name: string
    price: number
  }
  provider: {
    businessName: string
  }
}

export default function CustomerDashboard() {
  const router = useRouter()
  const { user, isLoading, isCustomer } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])

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

  const upcomingBookings = bookings.filter(
    (b) =>
      new Date(b.bookingDate) >= new Date() &&
      (b.status === "pending" || b.status === "confirmed")
  )

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
              className="py-3 border-b-2 border-green-600 text-green-600 font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/customer/bookings"
              className="py-3 text-gray-600 hover:text-gray-900"
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
        <h1 className="text-3xl font-bold mb-8">Välkommen tillbaka, {user?.name?.split(" ")[0]}!</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Kommande bokningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{upcomingBookings.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Totalt bokningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Väntande svar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {bookings.filter((b) => b.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Snabblänkar</CardTitle>
            <CardDescription>Vanliga åtgärder</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/providers">
                <Button className="w-full">Hitta tjänster</Button>
              </Link>
              <Link href="/customer/bookings">
                <Button className="w-full" variant="outline">
                  Mina bokningar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Kommande bokningar</CardTitle>
              <CardDescription>
                Dina nästa {upcomingBookings.length} bokningar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingBookings.slice(0, 3).map((booking) => (
                  <div
                    key={booking.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-semibold">{booking.service.name}</h3>
                      <p className="text-sm text-gray-600">
                        {booking.provider.businessName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(booking.bookingDate), "d MMMM yyyy", {
                          locale: sv,
                        })}{" "}
                        • {booking.startTime}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          booking.status === "confirmed"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {booking.status === "confirmed"
                          ? "Bekräftad"
                          : "Väntar på svar"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {upcomingBookings.length > 3 && (
                <div className="mt-4">
                  <Link href="/customer/bookings">
                    <Button variant="link">Se alla bokningar →</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {bookings.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">
                Du har inga bokningar ännu. Utforska våra tjänsteleverantörer för
                att komma igång!
              </p>
              <Link href="/providers">
                <Button>Hitta tjänster</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
