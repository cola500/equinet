"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { Header } from "@/components/layout/Header"

interface RouteStop {
  id: string
  locationName: string
  address: string
  latitude?: number
  longitude?: number
  stopOrder: number
}

interface Announcement {
  id: string
  serviceType: string
  address: string
  latitude?: number
  longitude?: number
  dateFrom: string
  dateTo: string
  status: string
  specialInstructions?: string
  provider: {
    id: string
    businessName: string
    description?: string
    profileImageUrl?: string
  }
  routeStops: RouteStop[]
}

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [serviceType, setServiceType] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Geo-filtering state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [savedLocation, setSavedLocation] = useState<{ lat: number; lng: number; city?: string } | null>(null)
  const [radiusKm, setRadiusKm] = useState(50)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Fetch user's saved location from profile
  useEffect(() => {
    const fetchSavedLocation = async () => {
      if (!user) {
        setProfileLoading(false)
        fetchAnnouncements()
        return
      }

      try {
        const response = await fetch("/api/profile")
        if (response.ok) {
          const profile = await response.json()
          if (profile.latitude && profile.longitude) {
            const saved = {
              lat: profile.latitude,
              lng: profile.longitude,
              city: profile.city || undefined,
            }
            setSavedLocation(saved)
            setUserLocation(saved)
            // Auto-search with saved location
            fetchAnnouncements({
              latitude: saved.lat,
              longitude: saved.lng,
              radiusKm,
            })
          } else {
            fetchAnnouncements()
          }
        } else {
          fetchAnnouncements()
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
        fetchAnnouncements()
      } finally {
        setProfileLoading(false)
      }
    }

    fetchSavedLocation()
  }, [user])

  const fetchAnnouncements = async (filters?: {
    serviceType?: string
    latitude?: number
    longitude?: number
    radiusKm?: number
  }) => {
    try {
      setIsLoading(true)
      setError(null)
      const params = new URLSearchParams()

      if (filters?.serviceType) {
        params.append("serviceType", filters.serviceType)
      }

      // Add geo-filtering params
      if (filters?.latitude && filters?.longitude && filters?.radiusKm) {
        params.append("latitude", filters.latitude.toString())
        params.append("longitude", filters.longitude.toString())
        params.append("radiusKm", filters.radiusKm.toString())
      }

      const url = params.toString()
        ? `/api/route-orders/announcements?${params.toString()}`
        : "/api/route-orders/announcements"

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data)
      } else {
        setError("Kunde inte hämta rutt-annonser")
      }
    } catch (error) {
      console.error("Error fetching announcements:", error)
      setError("Något gick fel. Försök igen senare.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    fetchAnnouncements({
      serviceType: serviceType || undefined,
      latitude: userLocation?.lat,
      longitude: userLocation?.lng,
      radiusKm: userLocation ? radiusKm : undefined,
    })
  }

  const handleClearFilters = () => {
    setServiceType("")
    setUserLocation(null)
    setRadiusKm(50)
    setLocationError(null)
    fetchAnnouncements()
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
        setLocationLoading(false)
        // Auto-search when location is obtained
        fetchAnnouncements({
          serviceType: serviceType || undefined,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radiusKm,
        })
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
        maximumAge: 300000, // Cache for 5 minutes
      }
    )
  }

  const clearLocation = () => {
    setUserLocation(null)
    setLocationError(null)
    fetchAnnouncements({
      serviceType: serviceType || undefined,
    })
  }

  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius)
    if (userLocation) {
      fetchAnnouncements({
        serviceType: serviceType || undefined,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radiusKm: newRadius,
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const hasActiveFilters = serviceType || userLocation

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Planerade rutter</h1>
          <p className="text-gray-600 mb-8">
            Hitta leverantörer som är på väg i ditt område och boka direkt på deras rutt
          </p>

          {/* Search/Filter Section */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              {/* Filter Row */}
              <div className="flex flex-wrap gap-4 items-start">
                <Input
                  placeholder="Filtrera på tjänstetyp (t.ex. Hovslagning)..."
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />

                {/* Location Controls */}
                <div className="flex gap-2 items-center">
                  {userLocation ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                        {savedLocation && userLocation.lat === savedLocation.lat && userLocation.lng === savedLocation.lng
                          ? `Min plats${savedLocation.city ? ` (${savedLocation.city})` : ""}`
                          : "Position aktiv"}
                      </span>
                      <select
                        value={radiusKm}
                        onChange={(e) => handleRadiusChange(Number(e.target.value))}
                        className="border rounded-md px-3 py-2 text-sm bg-white"
                      >
                        <option value={25}>25 km</option>
                        <option value={50}>50 km</option>
                        <option value={100}>100 km</option>
                        <option value={200}>200 km</option>
                      </select>
                      <Button
                        onClick={clearLocation}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500"
                      >
                        X
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      {user && !savedLocation && !profileLoading && (
                        <Link href="/customer/profile">
                          <Button variant="outline" size="sm">
                            Spara min plats i profilen
                          </Button>
                        </Link>
                      )}
                      <Button
                        onClick={requestLocation}
                        variant="outline"
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
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Hämtar position...
                          </>
                        ) : (
                          <>
                            <svg
                              className="mr-2 h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            Använd min position
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Button onClick={handleSearch}>Sök</Button>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Rensa
                  </Button>
                )}
              </div>

              {/* Location Error */}
              {locationError && (
                <p className="text-sm text-red-600">{locationError}</p>
              )}

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span>Aktiva filter:</span>
                  {serviceType && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                      Tjänst: "{serviceType}"
                      <button
                        type="button"
                        onClick={() => {
                          setServiceType("")
                          fetchAnnouncements({
                            latitude: userLocation?.lat,
                            longitude: userLocation?.lng,
                            radiusKm: userLocation ? radiusKm : undefined,
                          })
                        }}
                        className="hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {userLocation && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                      Inom {radiusKm} km
                      <button
                        type="button"
                        onClick={clearLocation}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Announcements List */}
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Något gick fel
                </h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={() => fetchAnnouncements()}>
                  Försök igen
                </Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Laddar rutt-annonser...</p>
            </div>
          ) : announcements.length === 0 ? (
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
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {hasActiveFilters
                    ? "Inga rutter matchar dina filter"
                    : "Inga planerade rutter just nu"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {hasActiveFilters
                    ? "Prova att utöka sökradien eller ändra filtren."
                    : "Det finns inga planerade rutter tillgängliga just nu. Kom tillbaka senare!"}
                </p>
                {hasActiveFilters ? (
                  <Button onClick={handleClearFilters}>Rensa filter</Button>
                ) : (
                  <Link href="/providers">
                    <Button>Sök bland alla leverantörer istället</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Results count */}
              <p className="text-sm text-gray-600">
                {announcements.length} {announcements.length === 1 ? "rutt hittad" : "rutter hittade"}
                {userLocation && ` inom ${radiusKm} km`}
              </p>

              {announcements.map((announcement) => (
                <Card key={announcement.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {announcement.provider.businessName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {announcement.serviceType} •{" "}
                          {formatDate(announcement.dateFrom)} - {formatDate(announcement.dateTo)}
                        </CardDescription>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        Öppen för bokningar
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {announcement.provider.description && (
                      <p className="text-sm text-gray-600 mb-4">
                        {announcement.provider.description}
                      </p>
                    )}

                    {/* Route Stops */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-gray-700">
                        Platser längs rutten:
                      </h4>
                      <div className="space-y-2">
                        {announcement.routeStops.map((stop) => (
                          <div key={stop.id} className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 font-semibold text-xs flex-shrink-0">
                              {stop.stopOrder}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{stop.locationName}</p>
                              <p className="text-xs text-gray-500">{stop.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special Instructions */}
                    {announcement.specialInstructions && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Information: </span>
                          {announcement.specialInstructions}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Link
                        href={`/providers/${announcement.provider.id}`}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full">
                          Se leverantörens profil
                        </Button>
                      </Link>
                      {user ? (
                        <Link
                          href={`/announcements/${announcement.id}/book`}
                          className="flex-1"
                        >
                          <Button className="w-full">Boka på denna rutt</Button>
                        </Link>
                      ) : (
                        <Link href="/login" className="flex-1">
                          <Button className="w-full">Logga in för att boka</Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
