"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useServices } from "@/hooks/useServices"
import { useBookings as useSWRBookings } from "@/hooks/useBookings"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { ErrorState } from "@/components/ui/error-state"
import { useRetry } from "@/hooks/useRetry"
import { toast } from "sonner"
import { OnboardingChecklist } from "@/components/provider/OnboardingChecklist"
import { StarRating } from "@/components/review/StarRating"

export default function ProviderDashboard() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const { services, isLoading: isLoadingServices } = useServices()
  const { bookings, isLoading: isLoadingBookings } = useSWRBookings()
  const [routes, setRoutes] = useState([])
  const [availableRouteOrders, setAvailableRouteOrders] = useState([])
  const [error, setError] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [reviewStats, setReviewStats] = useState<{
    averageRating: number | null
    totalCount: number
  }>({ averageRating: null, totalCount: 0 })
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
        fetchRoutes(),
        fetchAvailableRouteOrders(),
        fetchReviewStats(),
      ])
    } catch (error) {
      console.error("Error fetching data:", error)
      setError("Kunde inte hämta data. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingData(false)
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

  const fetchReviewStats = async () => {
    try {
      const profileRes = await fetch("/api/profile")
      if (!profileRes.ok) return
      const profile = await profileRes.json()
      if (!profile.providerId) return

      const response = await fetch(`/api/providers/${profile.providerId}/reviews?limit=1`)
      if (response.ok) {
        const data = await response.json()
        setReviewStats({
          averageRating: data.averageRating,
          totalCount: data.totalCount,
        })
      }
    } catch (error) {
      console.error("Error fetching review stats:", error)
    }
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
        ) : (isLoadingData || isLoadingServices || isLoadingBookings) ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar dashboard...</p>
          </div>
        ) : (
          <>
            {/* Onboarding Checklist for new providers */}
            <div className="mb-8">
              <OnboardingChecklist />
            </div>

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

          <Link href="/provider/reviews">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  Recensioner
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviewStats.totalCount > 0 && reviewStats.averageRating !== null ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold">{reviewStats.averageRating.toFixed(1)}</span>
                      <StarRating rating={Math.round(reviewStats.averageRating)} readonly size="sm" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {reviewStats.totalCount} {reviewStats.totalCount === 1 ? "recension" : "recensioner"}
                    </p>
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-gray-300">--</div>
                )}
              </CardContent>
            </Card>
          </Link>
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inga tjänster ännu
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Skapa din första tjänst för att börja ta emot bokningar.
                Lägg till namn, pris och varaktighet.
              </p>
              <Link href="/provider/services">
                <Button size="lg">Skapa din första tjänst</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {services.length > 0 && bookings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="mb-3">
                <svg
                  className="mx-auto h-10 w-10 text-gray-400"
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
                Inga bokningar ännu
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Dina tjänster finns tillgängliga. Bokningar dyker upp här
                när kunder börjar boka.
              </p>
            </CardContent>
          </Card>
        )}
          </>
        )}
    </ProviderLayout>
  )
}
