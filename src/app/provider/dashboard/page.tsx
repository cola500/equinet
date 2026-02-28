"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useServices } from "@/hooks/useServices"
import { useBookings as useSWRBookings } from "@/hooks/useBookings"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { ErrorState } from "@/components/ui/error-state"
import { OfflineErrorState } from "@/components/ui/OfflineErrorState"
import { useRetry } from "@/hooks/useRetry"
import { toast } from "sonner"
import { OnboardingChecklist } from "@/components/provider/OnboardingChecklist"
import { StarRating } from "@/components/review/StarRating"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { CalendarDays, Users, CalendarRange, Map, Mic, ChevronDown, Package } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { DashboardSkeleton } from "@/components/loading/DashboardSkeleton"
import { FirstUseTooltip } from "@/components/ui/first-use-tooltip"
import { DashboardCharts } from "@/components/provider/DashboardCharts"
import { PriorityActionCard } from "@/components/provider/PriorityActionCard"
import type { PriorityRoute } from "@/components/provider/PriorityActionCard"

export default function ProviderDashboard() {
  const { isLoading, isProvider } = useAuth()
  const isOnline = useOnlineStatus()
  const { services, isLoading: isLoadingServices } = useServices()
  const { bookings, isLoading: isLoadingBookings } = useSWRBookings()
  const [routes, setRoutes] = useState([])
  const [_availableRouteOrders, setAvailableRouteOrders] = useState([])
  const [error, setError] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [reviewStats, setReviewStats] = useState<{
    averageRating: number | null
    totalCount: number
  }>({ averageRating: null, totalCount: 0 })
  const [dashboardStats, setDashboardStats] = useState<{
    bookingTrend: Array<{ week: string; completed: number; cancelled: number }>
    revenueTrend: Array<{ month: string; revenue: number }>
  }>({ bookingTrend: [], revenueTrend: [] })
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [onboardingComplete, setOnboardingComplete] = useState(true)
  const [showCharts, setShowCharts] = useState<boolean | null>(null)
  const isVoiceLoggingEnabled = useFeatureFlag("voice_logging")
  const isRoutePlanningEnabled = useFeatureFlag("route_planning")
  const pendingCount = bookings.filter((b) => b.status === "pending").length
  const { retry, retryCount, isRetrying, canRetry } = useRetry({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      toast.error('Kunde inte hämta data efter flera försök. Kontakta support om problemet kvarstår.')
    },
  })

  useEffect(() => {
    if (isProvider) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs only on mount/auth change
  }, [isProvider])

  useEffect(() => {
    if (showCharts === null && !isLoadingBookings) {
      setShowCharts(bookings.length >= 10)
    }
  }, [showCharts, isLoadingBookings, bookings.length])

  const fetchData = async () => {
    setIsLoadingData(true)
    setError(null)
    try {
      await Promise.all([
        fetchRoutes(),
        fetchAvailableRouteOrders(),
        fetchReviewStats(),
        fetchDashboardStats(),
        fetchOnboardingStatus(),
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

  const fetchDashboardStats = async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch("/api/provider/dashboard/stats")
      if (response.ok) {
        const data = await response.json()
        setDashboardStats(data)
      }
    } catch (error) {
      // Non-critical -- silently ignore
      console.error("Error fetching dashboard stats:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  const fetchOnboardingStatus = async () => {
    try {
      const response = await fetch("/api/provider/onboarding-status")
      if (response.ok) {
        const data = await response.json()
        setOnboardingComplete(data.allComplete ?? true)
      }
    } catch {
      // Non-critical -- default to complete
    }
  }

  if (isLoading || !isProvider) {
    return (
      <ProviderLayout>
        <DashboardSkeleton />
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-8">Välkommen tillbaka!</h1>

        {error && !isOnline ? (
          <OfflineErrorState onRetry={fetchData} />
        ) : error ? (
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
            {/* Priority action -- "Vad ska jag göra nu?" */}
            <FirstUseTooltip
              id="dashboard-priority"
              title="Din nästa åtgärd"
              description="Här visas det viktigaste just nu -- nya förfrågningar, dagens rutt eller nästa steg"
            >
              <div>
                <PriorityActionCard
                  pendingCount={pendingCount}
                  routes={routes as PriorityRoute[]}
                  onboardingComplete={onboardingComplete}
                />
              </div>
            </FirstUseTooltip>

            {/* Onboarding Checklist for new providers */}
            <div className="mb-8">
              <OnboardingChecklist />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stats Cards */}
          <Link href="/provider/services">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  Aktiva tjänster
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {services.filter((s: { isActive: boolean }) => s.isActive).length}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/provider/bookings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  Kommande bokningar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {bookings.filter((b) =>
                    (b.status === "pending" || b.status === "confirmed") &&
                    new Date(b.bookingDate as string) >= new Date()
                  ).length}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/provider/bookings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  Nya förfrågningar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {pendingCount}
                </div>
              </CardContent>
            </Card>
          </Link>

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

        {/* Dashboard Charts -- collapsible */}
        <div className="mb-8">
          <button
            onClick={() => setShowCharts((prev) => !prev)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-3 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showCharts ? "rotate-0" : "-rotate-90"}`} />
            {showCharts ? "Dölj statistik" : "Visa statistik"}
          </button>
          {showCharts && (
            <DashboardCharts
              bookingTrend={dashboardStats.bookingTrend}
              revenueTrend={dashboardStats.revenueTrend}
              isLoading={isLoadingStats}
            />
          )}
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
                {routes.slice(0, 3).map((route: { id: string; routeName: string; routeDate: string; startTime: string; status: string; stops?: Array<{ status: string }> }) => {
                  const completedCount = route.stops?.filter((s: { status: string }) => s.status === "completed").length || 0
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/provider/bookings">
                <Button className="w-full" variant="outline">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Se bokningar
                  {pendingCount > 0 && (
                    <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link href="/provider/calendar">
                <Button className="w-full" variant="outline">
                  <CalendarRange className="h-4 w-4 mr-2" />
                  Kalender
                </Button>
              </Link>
              <Link href="/provider/customers">
                <Button className="w-full" variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Kundregister
                </Button>
              </Link>
              {isVoiceLoggingEnabled ? (
                <Link href="/provider/voice-log">
                  <Button className="w-full" variant="outline">
                    <Mic className="h-4 w-4 mr-2" />
                    Logga arbete
                  </Button>
                </Link>
              ) : isRoutePlanningEnabled ? (
                <Link href="/provider/route-planning">
                  <Button className="w-full" variant="outline">
                    <Map className="h-4 w-4 mr-2" />
                    Planera rutter
                  </Button>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {services.length === 0 && (
          <EmptyState
            icon={Package}
            title="Inga tjänster ännu"
            description="Skapa din första tjänst för att börja ta emot bokningar. Lägg till namn, pris och varaktighet."
            action={{ label: "Skapa din första tjänst", href: "/provider/services" }}
          />
        )}

        {services.length > 0 && bookings.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="Inga bokningar ännu"
            description="Dina tjänster finns tillgängliga. Bokningar dyker upp här när kunder börjar boka."
          />
        )}
          </>
        )}
    </ProviderLayout>
  )
}
