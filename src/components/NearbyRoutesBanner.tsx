"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface RouteStop {
  locationName: string | null
  address: string
}

interface NearbyRoute {
  id: string
  dateFrom: string
  dateTo: string
  routeStops: RouteStop[]
}

interface NearbyRoutesBannerProps {
  providerId: string
  customerLocation?: {
    latitude: number
    longitude: number
  } | null
}

function formatDateRange(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)

  const formatOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  }

  const fromStr = from.toLocaleDateString("sv-SE", formatOptions)
  const toStr = to.toLocaleDateString("sv-SE", formatOptions)

  if (fromStr === toStr) {
    return fromStr
  }
  return `${fromStr} - ${toStr}`
}

function getLocationSummary(routeStops: RouteStop[]): string {
  if (routeStops.length === 0) {
    return ""
  }

  const locations = routeStops
    .map((stop) => stop.locationName || stop.address)
    .filter(Boolean)

  if (locations.length === 0) {
    return ""
  }

  if (locations.length <= 3) {
    return locations.join(" -> ")
  }

  return `${locations.slice(0, 3).join(" -> ")} +${locations.length - 3} till`
}

export function NearbyRoutesBanner({
  providerId,
  customerLocation,
}: NearbyRoutesBannerProps) {
  const [nearbyRoutes, setNearbyRoutes] = useState<NearbyRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState(customerLocation)

  // Fetch customer location from profile if not provided
  useEffect(() => {
    if (customerLocation) {
      setLocation(customerLocation)
      return
    }

    const fetchLocation = async () => {
      try {
        const response = await fetch("/api/profile")
        if (response.ok) {
          const profile = await response.json()
          if (profile.latitude && profile.longitude) {
            setLocation({
              latitude: profile.latitude,
              longitude: profile.longitude,
            })
          }
        }
      } catch (error) {
        console.error("Error fetching profile location:", error)
      }
    }

    fetchLocation()
  }, [customerLocation])

  // Fetch nearby routes when location is available
  useEffect(() => {
    if (!location) {
      setLoading(false)
      return
    }

    const fetchNearbyRoutes = async () => {
      try {
        const params = new URLSearchParams({
          providerId,
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          radiusKm: "50",
        })

        const response = await fetch(
          `/api/route-orders/announcements?${params}`
        )
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data)) {
            setNearbyRoutes(data)
          }
        }
      } catch (error) {
        console.error("Error fetching nearby routes:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNearbyRoutes()
  }, [providerId, location])

  // Don't render if loading, no location, or no routes
  if (loading || !location || nearbyRoutes.length === 0) {
    return null
  }

  // Show the first/closest route
  const route = nearbyRoutes[0]
  const locationSummary = getLocationSummary(route.routeStops)

  return (
    <div
      className="mb-6 p-4 rounded-lg border-2 border-green-300 bg-green-50"
      data-testid="nearby-routes-banner"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">🚗</div>
        <div className="flex-1">
          <h3 className="font-semibold text-green-800">
            Kommer till ditt område!
          </h3>
          <p className="text-sm text-green-700 mt-1">
            {formatDateRange(route.dateFrom, route.dateTo)}
          </p>
          {locationSummary && (
            <p className="text-xs text-green-600 mt-1">
              Rutt: {locationSummary}
            </p>
          )}
        </div>
      </div>
      <Link href={`/announcements/${route.id}/book`}>
        <Button className="w-full mt-3 bg-green-600 hover:bg-green-700">
          Boka på rutten
        </Button>
      </Link>
    </div>
  )
}

// Export the route type for use in parent components
export type { NearbyRoute }
