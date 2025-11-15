"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { ErrorState } from "@/components/ui/error-state"
import { useRetry } from "@/hooks/useRetry"
import { toast } from "sonner"

export default function ProviderDashboard() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [routes, setRoutes] = useState([])
  const [availableRouteOrders, setAvailableRouteOrders] = useState([])
  const [error, setError] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const { retry, retryCount, isRetrying, canRetry } = useRetry({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      toast.error('Kunde inte hämta data efter flera försök. Kontakta support om problemet kvarstår.')
    },
  })

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchData()
    }
  }, [isProvider])

  const fetchData = async () => {
    setIsLoadingData(true)
    setError(null)
    try {
      await Promise.all([
        fetchServices(),
        fetchBookings(),
        fetchRoutes(),
        fetchAvailableRouteOrders()
      ])
    } catch (error) {
      console.error("Error fetching data:", error)
      setError("Kunde inte hämta data. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingData(false)
    }
  }

  const fetchServices = async () => {
    const response = await fetch("/api/services")
    if (response.ok) {
      const data = await response.json()
      setServices(data)
    } else {
      throw new Error("Failed to fetch services")
    }
  }

  const fetchBookings = async () => {
    const response = await fetch("/api/bookings")
    if (response.ok) {
      const data = await response.json()
      setBookings(data)
    } else {
      throw new Error("Failed to fetch bookings")
    }
  }

  const fetchRoutes = async () => {
    const response = await fetch("/api/routes/my-routes")
    if (response.ok) {
      const data = await response.json()
      setRoutes(data)
    }
    // Ignore errors for routes - not critical
  }

  const fetchAvailableRouteOrders = async () => {
    const response = await fetch("/api/route-orders/available")
    if (response.ok) {
      const data = await response.json()
      setAvailableRouteOrders(data)
    }
    // Ignore errors - not critical
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
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-8">Välkommen tillbaka!</h1>

        {error ? (
          <ErrorState
            title="Kunde inte hämta data"
            description={error}
            onRetry={() => retry(fetchData)}
            isRetrying={isRetrying}
            retryCount={retryCount}
            canRetry={canRetry}
            showContactSupport={retryCount >= 3}
          />
        ) : isLoadingData ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar dashboard...</p>
          </div>
        ) : (
          <>
            {/* Onboarding Checklist for new providers */}
            {services.length === 0 && bookings.length === 0 && (
              <Card className="mb-8 border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Välkommen till Equinet!
                  </CardTitle>
                  <CardDescription>
                    Kom igång med din leverantörsprofil genom att följa dessa steg
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Komplettera din profil</h4>
                        <p className="text-sm text-gray-600">
                          Lägg till information om ditt företag, kontaktuppgifter och en beskrivning.
                        </p>
                        <Link href="/provider/profile">
                          <Button size="sm" variant="link" className="px-0">
                            Gå till profil →
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Skapa din första tjänst</h4>
                        <p className="text-sm text-gray-600">
                          Lägg till de tjänster du erbjuder med pris och varaktighet.
                        </p>
                        <Link href="/provider/services">
                          <Button size="sm" variant="link" className="px-0">
                            Skapa tjänst →
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg opacity-60">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-semibold">
                        3
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Vänta på bokningar</h4>
                        <p className="text-sm text-gray-600">
                          När kunder hittar dig kommer bokningar visas under "Bokningar".
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              <div className="text-3xl font-bold">
                {bookings.filter((b: any) =>
                  (b.status === "pending" || b.status === "confirmed") &&
                  new Date(b.bookingDate) >= new Date()
                ).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Nya förfrågningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {bookings.filter((b: any) => b.status === "pending").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Tillgängliga ruttbeställningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {availableRouteOrders.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Routes Section */}
        {routes.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Aktiva rutter</CardTitle>
                  <CardDescription>Dina planerade och pågående rutter</CardDescription>
                </div>
                <Link href="/provider/routes">
                  <Button variant="outline" size="sm">
                    Se alla rutter →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {routes.slice(0, 3).map((route: any) => {
                  const completedCount = route.stops?.filter((s: any) => s.status === "completed").length || 0
                  const totalStops = route.stops?.length || 0
                  const progressPercent = totalStops > 0 ? (completedCount / totalStops) * 100 : 0

                  return (
                    <Link key={route.id} href={`/provider/routes/${route.id}`}>
                      <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold">{route.routeName}</h4>
                            <p className="text-sm text-gray-600">
                              {route.routeDate && new Date(route.routeDate).toLocaleDateString('sv-SE')} • Starttid: {route.startTime}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            route.status === "completed" ? "bg-blue-100 text-blue-800" :
                            route.status === "active" ? "bg-green-100 text-green-800" :
                            "bg-yellow-100 text-yellow-800"
                          }`}>
                            {route.status === "completed" ? "Klar" : route.status === "active" ? "Aktiv" : "Planerad"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {completedCount}/{totalStops} stopp
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Snabblänkar</CardTitle>
            <CardDescription>Vanliga åtgärder</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
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
              <Link href="/provider/route-planning">
                <Button className="w-full" variant="outline">
                  Planera rutter
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
          </>
        )}
    </ProviderLayout>
  )
}
