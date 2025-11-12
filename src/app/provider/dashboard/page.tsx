"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProviderDashboard() {
  const router = useRouter()
  const { user, isLoading, isProvider } = useAuth()
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchServices()
      // TODO: Fetch bookings
    }
  }, [isProvider])

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services")
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error("Error fetching services:", error)
    }
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
  }

  if (isLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
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
            <span className="text-sm text-gray-600">
              {user?.name}
            </span>
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
              href="/provider/dashboard"
              className="py-3 border-b-2 border-green-600 text-green-600 font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/provider/services"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Mina tjänster
            </Link>
            <Link
              href="/provider/bookings"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Bokningar
            </Link>
            <Link
              href="/provider/profile"
              className="py-3 text-gray-600 hover:text-gray-900"
            >
              Min profil
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Välkommen tillbaka!</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Aktiva tjänster
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {services.filter((s: any) => s.isActive).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Kommande bokningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Nya förfrågningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
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
              <Link href="/provider/services">
                <Button className="w-full" variant="outline">
                  Hantera tjänster
                </Button>
              </Link>
              <Link href="/provider/bookings">
                <Button className="w-full" variant="outline">
                  Se bokningar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Services */}
        {services.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dina tjänster</CardTitle>
              <CardDescription>
                {services.length} tjänster registrerade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.slice(0, 3).map((service: any) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-gray-600">
                        {service.durationMinutes} min • {service.price} kr
                      </p>
                    </div>
                    <div>
                      {service.isActive ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Aktiv
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          Inaktiv
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {services.length > 3 && (
                <div className="mt-4">
                  <Link href="/provider/services">
                    <Button variant="link">Se alla tjänster →</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {services.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">
                Du har inga tjänster ännu. Skapa din första tjänst för att komma igång!
              </p>
              <Link href="/provider/services">
                <Button>Skapa tjänst</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
