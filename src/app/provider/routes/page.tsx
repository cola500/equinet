"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { OfflineErrorState } from "@/components/ui/OfflineErrorState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface Route {
  id: string
  routeName: string
  routeDate: string
  startTime: string
  status: string
  totalDistanceKm?: number
  totalDurationMinutes?: number
  stops: Array<{
    id: string
    stopOrder: number
    status: string
    routeOrder: {
      address: string
      serviceType: string
    }
  }>
}

export default function ProviderRoutesPage() {
  const { isLoading, isProvider } = useAuth()
  const isOnline = useOnlineStatus()
  const [routes, setRoutes] = useState<Route[]>([])
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isProvider) {
      fetchRoutes()
    }
  }, [isProvider])

  const fetchRoutes = async () => {
    try {
      setIsLoadingRoutes(true)
      setError(null)
      const response = await fetch("/api/routes/my-routes")
      if (response.ok) {
        const data = await response.json()
        setRoutes(data)
      } else {
        setError("Kunde inte hämta rutter")
      }
    } catch (error) {
      console.error("Error fetching routes:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingRoutes(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      planned: { variant: "secondary", label: "Planerad" },
      active: { variant: "default", label: "Aktiv" },
      completed: { variant: "outline", label: "Klar" },
      cancelled: { variant: "destructive", label: "Avbruten" },
    }

    const config = variants[status] || { variant: "secondary", label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getRouteProgress = (route: Route) => {
    const total = route.stops.length
    const completed = route.stops.filter(s => s.status === "completed").length
    return { completed, total }
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

  return (
    <ProviderLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mina Rutter</h1>
            <p className="text-gray-600 mt-2">
              Översikt över alla dina planerade och genomförda rutter
            </p>
          </div>
          <Link href="/provider/route-planning">
            <Button>+ Planera ny rutt</Button>
          </Link>
        </div>

        {error && !isOnline ? (
          <OfflineErrorState onRetry={fetchRoutes} />
        ) : error ? (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {isLoadingRoutes ? (
          <p className="text-gray-500">Laddar rutter...</p>
        ) : routes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500 mb-4">Du har inga rutter än</p>
              <Link href="/provider/route-planning">
                <Button>Planera din första rutt</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => {
              const progress = getRouteProgress(route)
              return (
                <Card key={route.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{route.routeName}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {format(new Date(route.routeDate), "EEEE d MMMM yyyy", { locale: sv })} • Starttid: {route.startTime}
                        </p>
                      </div>
                      {getStatusBadge(route.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Antal stopp</p>
                        <p className="text-lg font-medium">{route.stops.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Framsteg</p>
                        <p className="text-lg font-medium">
                          {progress.completed}/{progress.total}
                        </p>
                      </div>
                      {route.totalDistanceKm !== undefined && (
                        <div>
                          <p className="text-sm text-gray-600">Sträcka</p>
                          <p className="text-lg font-medium">{route.totalDistanceKm} km</p>
                        </div>
                      )}
                      {route.totalDurationMinutes !== undefined && (
                        <div>
                          <p className="text-sm text-gray-600">Tid</p>
                          <p className="text-lg font-medium">
                            {Math.round(route.totalDurationMinutes / 60)}h {route.totalDurationMinutes % 60}min
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Stops preview */}
                    <div className="space-y-2 mb-4">
                      {route.stops.slice(0, 3).map((stop) => (
                        <div key={stop.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="w-16 justify-center">
                            #{stop.stopOrder}
                          </Badge>
                          <span className="capitalize">{stop.routeOrder.serviceType}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-600">{stop.routeOrder.address}</span>
                          {stop.status === "completed" && (
                            <Badge variant="outline" className="ml-auto">✓ Klar</Badge>
                          )}
                        </div>
                      ))}
                      {route.stops.length > 3 && (
                        <p className="text-sm text-gray-500">
                          + {route.stops.length - 3} fler stopp
                        </p>
                      )}
                    </div>

                    <Link href={`/provider/routes/${route.id}`}>
                      <Button variant="outline" className="w-full">
                        {{ planned: "Se detaljer", active: "Kör rutt", completed: "Se historik", cancelled: "Se detaljer" }[route.status] ?? "Se detaljer"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </ProviderLayout>
  )
}
