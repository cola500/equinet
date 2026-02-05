"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { calculateDistance } from "@/lib/geo/distance"

interface GroupBookingParticipant {
  id: string
  userId: string
  numberOfHorses: number
  status: string
  user: { firstName: string }
}

interface GroupBookingRequest {
  id: string
  serviceType: string
  locationName: string
  address: string
  dateFrom: string
  dateTo: string
  maxParticipants: number
  status: string
  notes: string | null
  latitude: number | null
  longitude: number | null
  participants: GroupBookingParticipant[]
  _count: { participants: number }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  })
}

export default function ProviderGroupBookingsPage() {
  const router = useRouter()
  const { isLoading: authLoading, isProvider } = useAuth()
  const [groupBookings, setGroupBookings] = useState<GroupBookingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Geo-filtering state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(50)
  const [searchPlace, setSearchPlace] = useState("")
  const [searchPlaceName, setSearchPlaceName] = useState<string | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  const fetchAvailable = useCallback(async () => {
    try {
      const response = await fetch("/api/group-bookings/available")
      if (response.ok) {
        const data = await response.json()
        setGroupBookings(data)
      } else {
        toast.error("Kunde inte hämta grupprequests")
      }
    } catch (error) {
      console.error("Error fetching available group bookings:", error)
      toast.error("Kunde inte hämta grupprequests")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isProvider) {
      fetchAvailable()
    }
  }, [isProvider, fetchAvailable])

  const handleSearchPlace = async () => {
    const trimmed = searchPlace.trim()
    if (!trimmed) return

    setIsGeocoding(true)
    setLocationError(null)

    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(trimmed)}`)
      if (response.ok) {
        const data = await response.json()
        setUserLocation({ lat: data.latitude, lng: data.longitude })
        setSearchPlaceName(trimmed)
      } else {
        setLocationError("Kunde inte hitta platsen. Prova en annan ort eller postnummer.")
      }
    } catch {
      setLocationError("Något gick fel vid sökning. Försök igen.")
    } finally {
      setIsGeocoding(false)
    }
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Din webbläsare stöder inte platsdelning")
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setSearchPlaceName(null)
        setSearchPlace("")
        setLocationLoading(false)
      },
      (err) => {
        console.error("Geolocation error:", err)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError("Du nekade platsåtkomst. Tillåt platsdelning i webbläsarens inställningar.")
            break
          case err.POSITION_UNAVAILABLE:
            setLocationError("Din plats kunde inte fastställas")
            break
          case err.TIMEOUT:
            setLocationError("Det tog för lång tid att hämta din plats")
            break
          default:
            setLocationError("Kunde inte hämta din plats")
        }
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  }

  const clearLocation = () => {
    setUserLocation(null)
    setLocationError(null)
    setSearchPlaceName(null)
    setSearchPlace("")
  }

  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius)
  }

  const filteredGroupBookings = useMemo(() => {
    if (!userLocation) return groupBookings
    return groupBookings.filter((gb) => {
      if (gb.latitude == null || gb.longitude == null) return true
      return calculateDistance(userLocation.lat, userLocation.lng, gb.latitude, gb.longitude) <= radiusKm
    })
  }, [groupBookings, userLocation, radiusKm])

  if (authLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  const totalHorses = (gb: GroupBookingRequest) =>
    gb.participants.reduce((sum, p) => sum + p.numberOfHorses, 0)

  return (
    <ProviderLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Öppna grupprequests</h1>
        <p className="text-gray-600 mt-2">
          Stallgemenskaper som söker leverantör. Matcha för att skapa bokningar
          för alla deltagare.
        </p>
      </div>

      {/* Geo filter */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Sök i närheten:</span>
          <div className="flex gap-2 items-center flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder="Ort, stad eller postnummer..."
              value={searchPlace}
              onChange={(e) => setSearchPlace(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearchPlace() }}
              className="flex-1"
            />
            <Button
              onClick={handleSearchPlace}
              disabled={isGeocoding || !searchPlace.trim()}
              variant="outline"
            >
              {isGeocoding ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Söker...
                </>
              ) : (
                "Sök plats"
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button
            onClick={requestLocation}
            variant="outline"
            size="sm"
            disabled={locationLoading}
          >
            {locationLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Hämtar position...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Använd min position
              </>
            )}
          </Button>

          {userLocation && (
            <select
              value={radiusKm}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              className="border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value={25}>25 km</option>
              <option value={50}>50 km</option>
              <option value={100}>100 km</option>
            </select>
          )}
        </div>

        {locationError && (
          <p className="text-sm text-red-600">{locationError}</p>
        )}

        {userLocation && (
          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
            <span>Aktivt filter:</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full">
              {searchPlaceName ? searchPlaceName : "Min position"}, inom {radiusKm} km
              <button
                type="button"
                onClick={clearLocation}
                className="hover:text-orange-900 ml-1"
              >
                x
              </button>
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar grupprequests...</p>
        </div>
      ) : groupBookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">
              Inga öppna grupprequests just nu.
            </p>
            <p className="text-sm text-gray-500">
              När hästägare skapar grupprequests i ditt område visas de här.
            </p>
          </CardContent>
        </Card>
      ) : filteredGroupBookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">
              Inga grupprequests i detta område.
            </p>
            <p className="text-sm text-gray-500">
              Försök med en större radie eller{" "}
              <button
                onClick={clearLocation}
                className="text-green-600 hover:text-green-700 font-medium"
              >
                rensa filtret
              </button>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredGroupBookings.map((gb) => (
            <Link key={gb.id} href={`/provider/group-bookings/${gb.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{gb.serviceType}</CardTitle>
                    <Badge className="bg-green-100 text-green-800">
                      {gb._count.participants} deltagare
                    </Badge>
                  </div>
                  <CardDescription>
                    {gb.locationName} &middot; {formatDate(gb.dateFrom)} &ndash;{" "}
                    {formatDate(gb.dateTo)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {totalHorses(gb)} {totalHorses(gb) === 1 ? "häst" : "hästar"} totalt
                    </span>
                    <span>{gb.address}</span>
                  </div>
                  {gb.notes && (
                    <p className="text-sm text-gray-500 mt-2 truncate">
                      {gb.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </ProviderLayout>
  )
}
