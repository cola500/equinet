"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface RouteStop {
  id: string
  stopOrder: number
  estimatedArrival?: string
  estimatedDurationMin: number
  actualArrival?: string
  actualDeparture?: string
  status: string
  problemNote?: string
  routeOrder: {
    id: string
    address: string
    serviceType: string
    numberOfHorses: number
    specialInstructions?: string
    customer: {
      firstName: string
      lastName: string
      phone?: string
    } | null
  }
}

interface Route {
  id: string
  routeName: string
  routeDate: string
  startTime: string
  status: string
  totalDistanceKm?: number
  totalDurationMinutes?: number
  stops: RouteStop[]
}

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [route, setRoute] = useState<Route | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(true)
  const [updatingStopId, setUpdatingStopId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchRoute()
    }
  }, [isProvider, resolvedParams.id])

  const fetchRoute = async () => {
    try {
      setIsLoadingRoute(true)
      setError(null)
      const response = await fetch(`/api/routes/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setRoute(data)
      } else {
        setError("Kunde inte hämta rutt")
      }
    } catch (error) {
      console.error("Error fetching route:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingRoute(false)
    }
  }

  const updateStopStatus = async (stopId: string, status: string) => {
    setUpdatingStopId(stopId)

    try {
      const response = await fetch(`/api/routes/${resolvedParams.id}/stops/${stopId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Kunde inte uppdatera stopp")
      }

      toast.success(status === "completed" ? "Stopp markerat som klart!" : "Status uppdaterad")
      await fetchRoute() // Refresh route data
    } catch (error: any) {
      console.error("Error updating stop:", error)
      toast.error(error.message || "Något gick fel")
    } finally {
      setUpdatingStopId(null)
    }
  }

  const getStopStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: string }> = {
      pending: { variant: "secondary", label: "Väntande", icon: "⏹️" },
      in_progress: { variant: "default", label: "Pågående", icon: "▶️" },
      completed: { variant: "outline", label: "Klar", icon: "✅" },
      problem: { variant: "destructive", label: "Problem", icon: "⚠️" },
    }

    const config = variants[status] || variants.pending
    return (
      <Badge variant={config.variant}>
        {config.icon} {config.label}
      </Badge>
    )
  }

  const getCurrentStop = () => {
    if (!route) return null
    return route.stops.find(s => s.status === "in_progress") ||
           route.stops.find(s => s.status === "pending")
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

  if (isLoadingRoute) {
    return (
      <ProviderLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-500">Laddar rutt...</p>
        </div>
      </ProviderLayout>
    )
  }

  if (error || !route) {
    return (
      <ProviderLayout>
        <div className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error || "Rutt hittades inte"}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/provider/routes")}
              >
                Tillbaka till rutter
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProviderLayout>
    )
  }

  const currentStop = getCurrentStop()
  const completedCount = route.stops.filter(s => s.status === "completed").length

  return (
    <ProviderLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.push("/provider/routes")} className="mb-4">
            ← Tillbaka till rutter
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{route.routeName}</h1>
              <p className="text-gray-600 mt-1">
                {format(new Date(route.routeDate), "EEEE d MMMM yyyy", { locale: sv })} • Start: {route.startTime}
              </p>
            </div>
            <Badge variant={route.status === "completed" ? "outline" : "default"}>
              {route.status === "planned" && "Planerad"}
              {route.status === "active" && "Aktiv"}
              {route.status === "completed" && "Klar"}
              {route.status === "cancelled" && "Avbruten"}
            </Badge>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Framsteg</span>
              <span className="text-sm text-gray-600">
                {completedCount} av {route.stops.length} stopp klara
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{ width: `${(completedCount / route.stops.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Current Stop Highlight */}
        {currentStop && currentStop.status !== "completed" && (
          <Card className="mb-6 border-green-500 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStop.status === "in_progress" ? "▶️" : "⏹️"}
                {currentStop.status === "in_progress" ? "Aktivt Stopp" : "Nästa Stopp"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-lg font-medium">
                  Stopp #{currentStop.stopOrder} - {currentStop.routeOrder.customer
                    ? `${currentStop.routeOrder.customer.firstName} ${currentStop.routeOrder.customer.lastName}`
                    : "Ingen kund"}
                </p>
                <p className="text-gray-700">{currentStop.routeOrder.address}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Tjänst:</p>
                  <p className="font-medium capitalize">{currentStop.routeOrder.serviceType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hästar:</p>
                  <p className="font-medium">{currentStop.routeOrder.numberOfHorses}</p>
                </div>
              </div>
              {currentStop.estimatedArrival && (
                <div>
                  <p className="text-sm text-gray-600">Beräknad ankomst:</p>
                  <p className="font-medium">
                    {format(new Date(currentStop.estimatedArrival), "HH:mm", { locale: sv })}
                  </p>
                </div>
              )}
              {currentStop.routeOrder.specialInstructions && (
                <div>
                  <p className="text-sm text-gray-600">Instruktioner:</p>
                  <p className="font-medium">💬 {currentStop.routeOrder.specialInstructions}</p>
                </div>
              )}
              {currentStop.routeOrder.customer?.phone && (
                <div>
                  <p className="text-sm text-gray-600">Kontakt:</p>
                  <p className="font-medium">📞 {currentStop.routeOrder.customer.phone}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {currentStop.status === "pending" && (
                  <Button
                    onClick={() => updateStopStatus(currentStop.id, "in_progress")}
                    disabled={updatingStopId === currentStop.id}
                    className="flex-1"
                  >
                    Påbörja besök
                  </Button>
                )}
                {currentStop.status === "in_progress" && (
                  <Button
                    onClick={() => updateStopStatus(currentStop.id, "completed")}
                    disabled={updatingStopId === currentStop.id}
                    className="flex-1"
                  >
                    ✅ Markera som klar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Stops */}
        <Card>
          <CardHeader>
            <CardTitle>Alla Stopp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {route.stops.map((stop) => (
              <div
                key={stop.id}
                className={`border rounded-lg p-4 ${
                  stop.id === currentStop?.id
                    ? "border-green-500 bg-green-50"
                    : stop.status === "completed"
                    ? "border-gray-300 bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{stop.stopOrder}</Badge>
                    <span className="font-medium">
                      {stop.routeOrder.customer
                        ? `${stop.routeOrder.customer.firstName} ${stop.routeOrder.customer.lastName}`
                        : "Ingen kund"}
                    </span>
                  </div>
                  {getStopStatusBadge(stop.status)}
                </div>
                <p className="text-sm text-gray-600 mb-2">{stop.routeOrder.address}</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Tjänst:</span>{" "}
                    <span className="capitalize">{stop.routeOrder.serviceType}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Hästar:</span> {stop.routeOrder.numberOfHorses}
                  </div>
                  {stop.estimatedArrival && (
                    <div>
                      <span className="text-gray-600">ETA:</span>{" "}
                      {format(new Date(stop.estimatedArrival), "HH:mm", { locale: sv })}
                    </div>
                  )}
                </div>
                {stop.actualArrival && stop.actualDeparture && (
                  <p className="text-xs text-gray-500 mt-2">
                    Besök: {format(new Date(stop.actualArrival), "HH:mm", { locale: sv })} -{" "}
                    {format(new Date(stop.actualDeparture), "HH:mm", { locale: sv })}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ProviderLayout>
  )
}
