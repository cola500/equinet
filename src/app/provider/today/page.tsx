"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { MapPin, Clock, Navigation } from "lucide-react"
import { fetcher } from "@/lib/swr"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OfflineNotAvailable } from "@/components/ui/OfflineNotAvailable"
import { GenericListSkeleton } from "@/components/loading/GenericListSkeleton"
import { calculateDistance } from "@/lib/geo/distance"
import { getRoute } from "@/lib/routing"
import { clientLogger } from "@/lib/client-logger"

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
  city: string | null
  latitude: number | null
  longitude: number | null
  customer: { firstName: string; lastName: string }
}

/** Full address (street + city) for display, or null if neither is set. */
function fullAddress(stop: Pick<DayRouteStop, "address" | "city">): string | null {
  const parts = [stop.address, stop.city].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

/**
 * Google Maps directions URL — platform-neutral (opens the Maps app on mobile,
 * web on desktop). Prefers coordinates; falls back to the address; null if neither.
 */
function mapsNavUrl(stop: DayRouteStop): string | null {
  const base = "https://www.google.com/maps/dir/?api=1&destination="
  if (stop.latitude != null && stop.longitude != null) {
    return base + encodeURIComponent(`${stop.latitude},${stop.longitude}`)
  }
  const addr = fullAddress(stop)
  return addr ? base + encodeURIComponent(addr) : null
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

  const stops = data?.stops ?? []
  const startLocation = data?.startLocation ?? undefined
  const stopsWithoutCoords = stops.filter((s) => s.latitude == null || s.longitude == null)
  const estimatedKm = estimateTotalDistanceKm(data?.startLocation ?? null, stops)

  // Ordered round-trip path (start -> stops in order -> start) in [lat, lon],
  // using only stops with coordinates. Needs >= 2 points for routing.
  const routePath = useMemo<[number, number][]>(() => {
    const pts = stops
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => [s.latitude as number, s.longitude as number] as [number, number])
    if (pts.length === 0) return []
    if (!startLocation) return pts
    return [[startLocation.lat, startLocation.lon], ...pts, [startLocation.lat, startLocation.lon]]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stops.map((s) => [s.latitude, s.longitude])), startLocation?.lat, startLocation?.lon])

  // Fetch the actual driving distance/time from OSRM (via routing.ts). Falls back
  // to the Haversine estimate when routing is unavailable or there are < 2 points.
  // We also keep the routed geometry (r.coordinates) so RouteMapVisualization can
  // reuse it instead of issuing a second identical OSRM request for the same path.
  const [routeMetrics, setRouteMetrics] = useState<{ km: number; min: number } | null>(null)
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null)
  const pathKey = routePath.map((p) => p.join(",")).join(";")
  useEffect(() => {
    let cancelled = false
    setRouteMetrics(null)
    setRouteGeometry(null)
    if (routePath.length < 2) return
    getRoute(routePath)
      .then((r) => {
        if (!cancelled) {
          setRouteMetrics({ km: r.distance / 1000, min: r.duration / 60 })
          setRouteGeometry(r.coordinates)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRouteMetrics(null)
          // Straight-line fallback geometry — mirrors the map's own fallback so the
          // line still renders when routing fails.
          setRouteGeometry(routePath)
          clientLogger.warn("Today route distance fell back to estimate", { error: String(err) })
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey])

  if (!isOnline) {
    return (
      <ProviderLayout>
        <OfflineNotAvailable pageName="Dagens rutt" />
      </ProviderLayout>
    )
  }

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
            {routeMetrics ? (
              <span>
                Körsträcka: {Math.round(routeMetrics.km)} km · ~{Math.round(routeMetrics.min)} min
              </span>
            ) : estimatedKm != null ? (
              <span>Uppskattad sträcka: ~{Math.round(estimatedKm)} km (fågelväg)</span>
            ) : null}
          </div>

          <RouteMapVisualization
            orders={orders}
            selectedOrderIds={selectedOrderIds}
            startLocation={startLocation}
            // Reuse the routed geometry we already fetched (avoids a duplicate OSRM
            // call). Only when the map would draw the original route (>= 2 stops with
            // coordinates); otherwise let the map decide for itself (undefined).
            precomputedRoutePath={
              stops.filter((s) => s.latitude != null && s.longitude != null).length >= 2
                ? routeGeometry
                : undefined
            }
          />

          {stopsWithoutCoords.length > 0 && (
            <p className="text-xs text-amber-600">
              {stopsWithoutCoords.length} stopp saknar koordinater och visas inte på kartan.
            </p>
          )}

          <ol className="space-y-2">
            {stops.map((stop, index) => {
              const address = fullAddress(stop)
              const navUrl = mapsNavUrl(stop)
              return (
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
                        {address && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {address}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400">{stop.serviceType}</p>
                      </div>
                      {navUrl && (
                        <a
                          href={navUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-center rounded-md border border-green-600 px-3 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50"
                          aria-label={`Navigera till ${stop.customer.firstName} ${stop.customer.lastName}${address ? `, ${address}` : ""}`}
                        >
                          <Navigation className="h-4 w-4" aria-hidden="true" />
                          Navigera
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </ProviderLayout>
  )
}
