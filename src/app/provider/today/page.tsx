"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { MapPin, Clock } from "lucide-react"
import { fetcher } from "@/lib/swr"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OfflineNotAvailable } from "@/components/ui/OfflineNotAvailable"
import { GenericListSkeleton } from "@/components/loading/GenericListSkeleton"
import { calculateDistance } from "@/lib/geo/distance"

// Dynamic import to avoid SSR issues with Leaflet.
const RouteMapVisualization = dynamic(
  () => import("@/components/RouteMapVisualization"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[clamp(280px,40vh,500px)] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-500">
        Laddar karta...
      </div>
    ),
  }
)

interface DayRouteStop {
  id: string
  startTime: string
  endTime: string
  serviceType: string
  address: string | null
  latitude: number | null
  longitude: number | null
  customer: { firstName: string; lastName: string }
}

interface TodayRouteResponse {
  date: string
  startLocation: { lat: number; lon: number } | null
  stops: DayRouteStop[]
}

/**
 * Total approximate driving distance (km) across the day, summed as a round
 * trip: start -> stop 1 -> ... -> stop N -> start. Uses Haversine straight-line
 * distance (a rough estimate, not the routed road distance shown on the map).
 * Stops without coordinates are skipped.
 */
function estimateTotalDistanceKm(
  startLocation: { lat: number; lon: number } | null,
  stops: DayRouteStop[]
): number | null {
  const points = stops
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ lat: s.latitude as number, lon: s.longitude as number }))

  if (points.length === 0) return null

  const path = startLocation ? [startLocation, ...points, startLocation] : points
  if (path.length < 2) return null

  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += calculateDistance(path[i - 1].lat, path[i - 1].lon, path[i].lat, path[i].lon)
  }
  return total
}

export default function TodayRoutePage() {
  const isOnline = useOnlineStatus()
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])

  const { data, error, isLoading } = useSWR<TodayRouteResponse>(
    `/api/provider/today-route?date=${date}`,
    fetcher
  )

  if (!isOnline) {
    return (
      <ProviderLayout>
        <OfflineNotAvailable pageName="Dagens rutt" />
      </ProviderLayout>
    )
  }

  const stops = data?.stops ?? []
  const startLocation = data?.startLocation ?? undefined
  const stopsWithoutCoords = stops.filter((s) => s.latitude == null || s.longitude == null)
  const totalKm = estimateTotalDistanceKm(data?.startLocation ?? null, stops)

  const orders = stops.map((s) => ({
    id: s.id,
    address: s.address ?? "",
    latitude: s.latitude,
    longitude: s.longitude,
    serviceType: s.serviceType,
    customer: s.customer,
  }))
  const selectedOrderIds = stops.map((s) => s.id)

  const prettyDate = (() => {
    try {
      return format(new Date(date), "EEEE d MMMM", { locale: sv })
    } catch {
      return date
    }
  })()

  return (
    <ProviderLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dagens rutt</h1>
          <p className="text-gray-600 mt-1 capitalize">{prettyDate}</p>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="route-date" className="text-xs text-gray-500">
            Välj dag
          </Label>
          <Input
            id="route-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-44"
          />
        </div>
      </div>

      {isLoading ? (
        <GenericListSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Kunde inte hämta dagens rutt. Försök igen.
          </CardContent>
        </Card>
      ) : stops.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p className="text-lg font-medium">Inga bokningar idag</p>
            <p className="mt-1 text-sm">
              Bekräftade och väntande bokningar för dagen visas här som en rutt.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="font-medium text-gray-900">
              {stops.length} stopp
            </span>
            {totalKm != null && (
              <span>Total körsträcka: ~{Math.round(totalKm)} km (fågelväg)</span>
            )}
          </div>

          <RouteMapVisualization
            orders={orders}
            selectedOrderIds={selectedOrderIds}
            startLocation={startLocation}
          />

          {stopsWithoutCoords.length > 0 && (
            <p className="text-xs text-amber-600">
              {stopsWithoutCoords.length} stopp saknar koordinater och visas inte på kartan.
            </p>
          )}

          <ol className="space-y-2">
            {stops.map((stop, index) => (
              <li key={stop.id}>
                <Card>
                  <CardContent className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        {stop.startTime}–{stop.endTime}
                      </div>
                      <p className="mt-0.5 font-medium text-gray-900">
                        {stop.customer.firstName} {stop.customer.lastName}
                      </p>
                      {stop.address && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {stop.address}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-400">{stop.serviceType}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      )}
    </ProviderLayout>
  )
}
