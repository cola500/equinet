"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { Header } from "@/components/layout/Header"
import { StarRating } from "@/components/review/StarRating"
import { ProviderCardSkeleton } from "@/components/loading/ProviderCardSkeleton"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { SlidersHorizontal, MapPin } from "lucide-react"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

// Format date as "3 feb"
function formatShortDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00")
  return format(date, "d MMM", { locale: sv })
}

interface Provider {
  id: string
  businessName: string
  description?: string
  city?: string
  profileImageUrl?: string | null
  services: Array<{
    id: string
    name: string
    price: number
    durationMinutes: number
  }>
  user: {
    firstName: string
    lastName: string
  }
  nextVisit?: {
    date: string
    location: string
  } | null
  reviewStats?: {
    averageRating: number | null
    totalCount: number
  }
}

type SortOption = "default" | "rating" | "reviews"

interface ProviderWithVisit {
  provider: Provider
  nextVisit: {
    date: string
    location: string
    startTime: string | null
    endTime: string | null
  }
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">Hitta tjänsteleverantörer</h1>
            <p className="text-gray-600 mb-8">
              Bläddra bland professionella hovslagare, veterinärer och andra hästtjänster
            </p>
            <ProviderCardSkeleton count={6} />
          </div>
        </main>
      </div>
    }>
      <ProvidersContent />
    </Suspense>
  )
}

function ProvidersContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const initializedFromUrl = useRef(false)
  const [providers, setProviders] = useState<Provider[]>([])
  const [visitingProviders, setVisitingProviders] = useState<ProviderWithVisit[]>([])
  const [search, setSearch] = useState(() => searchParams.get("search") || "")
  const [city, setCity] = useState(() => searchParams.get("city") || "")
  const [visitingArea, setVisitingArea] = useState(() => searchParams.get("visiting") || "")
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>(() => (searchParams.get("sort") as SortOption) || "default")

  // Geo-filtering state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusKm, setRadiusKm] = useState(50)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [searchPlace, setSearchPlace] = useState("")
  const [searchPlaceName, setSearchPlaceName] = useState<string | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  // Sync filter state to URL (no network request -- uses replaceState)
  useEffect(() => {
    if (!initializedFromUrl.current) {
      initializedFromUrl.current = true
      return
    }
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (city) params.set("city", city)
    if (visitingArea) params.set("visiting", visitingArea)
    if (sortBy !== "default") params.set("sort", sortBy)
    const qs = params.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, "", url)
  }, [search, city, visitingArea, sortBy])

  // Count active advanced filters (not counting main search)
  const activeFilterCount = [city, visitingArea, userLocation].filter(Boolean).length

  // Sort providers client-side
  const sortedProviders = [...providers].sort((a, b) => {
    if (sortBy === "rating") {
      const ratingA = a.reviewStats?.averageRating ?? 0
      const ratingB = b.reviewStats?.averageRating ?? 0
      return ratingB - ratingA
    }
    if (sortBy === "reviews") {
      const countA = a.reviewStats?.totalCount ?? 0
      const countB = b.reviewStats?.totalCount ?? 0
      return countB - countA
    }
    return 0 // default: API order
  })

  // Debounce search - sök automatiskt efter 500ms av inaktivitet
  // Initial load (tom sökning) hämtar direkt, sökningar debouncar
  useEffect(() => {
    const hasFilters = search || city
    if (hasFilters) {
      setIsSearching(true)
    }

    const geo = userLocation
      ? { latitude: userLocation.lat, longitude: userLocation.lng, radiusKm }
      : undefined

    const delay = hasFilters ? 500 : 0

    const timer = setTimeout(() => {
      fetchProviders(search, city, geo)
      setIsSearching(false)
    }, delay)

    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [search, city, radiusKm, userLocation])

  // Fetch providers visiting a specific area
  useEffect(() => {
    if (visitingArea.length < 2) {
      setVisitingProviders([])
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/providers/visiting-area?location=${encodeURIComponent(visitingArea)}`
        )
        if (response.ok) {
          const result = await response.json()
          setVisitingProviders(result.data)
        }
      } catch (error) {
        console.error("Error fetching visiting providers:", error)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [visitingArea])

  const fetchProviders = async (searchQuery?: string, cityQuery?: string, geo?: {
    latitude: number; longitude: number; radiusKm: number
  }) => {
    try {
      setIsLoading(true)
      setError(null)
      const params = new URLSearchParams()

      if (searchQuery) {
        params.append("search", searchQuery)
      }
      if (cityQuery) {
        params.append("city", cityQuery)
      }
      if (geo) {
        params.append("latitude", geo.latitude.toString())
        params.append("longitude", geo.longitude.toString())
        params.append("radiusKm", geo.radiusKm.toString())
      }

      const url = params.toString()
        ? `/api/providers?${params.toString()}`
        : "/api/providers"

      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        // API returns { data: Provider[], pagination: {...} }
        setProviders(result.data)
      } else {
        try {
          const errorData = await response.json()
          setError(errorData.error || "Kunde inte hämta leverantörer")
        } catch {
          setError("Kunde inte hämta leverantörer")
        }
      }
    } catch (error) {
      console.error("Error fetching providers:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoading(false)
    }
  }

  const _handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const geo = userLocation
      ? { latitude: userLocation.lat, longitude: userLocation.lng, radiusKm }
      : undefined
    fetchProviders(search, city, geo)
  }

  const handleClearFilters = () => {
    setSearch("")
    setCity("")
    setVisitingArea("")
    setVisitingProviders([])
    setUserLocation(null)
    setRadiusKm(50)
    setLocationError(null)
    setSearchPlaceName(null)
    setSearchPlace("")
    fetchProviders()
  }

  const handleSearchPlace = async () => {
    const trimmed = searchPlace.trim()
    if (!trimmed) return

    setIsGeocoding(true)
    setLocationError(null)

    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(trimmed)}`)
      if (response.ok) {
        const data = await response.json()
        const location = { lat: data.latitude, lng: data.longitude }
        setUserLocation(location)
        setSearchPlaceName(trimmed)
        fetchProviders(search, city, {
          latitude: location.lat,
          longitude: location.lng,
          radiusKm,
        })
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
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setUserLocation(location)
        setSearchPlaceName(null)
        setSearchPlace("")
        setLocationLoading(false)
        fetchProviders(search, city, {
          latitude: location.lat,
          longitude: location.lng,
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
        maximumAge: 300000,
      }
    )
  }

  const clearLocation = () => {
    setUserLocation(null)
    setLocationError(null)
    setSearchPlaceName(null)
    setSearchPlace("")
    fetchProviders(search, city)
  }

  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius)
    if (userLocation) {
      fetchProviders(search, city, {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radiusKm: newRadius,
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Hitta tjänsteleverantörer</h1>
          <p className="text-gray-600 mb-8">
            Bläddra bland professionella hovslagare, veterinärer och andra hästtjänster
          </p>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              {/* Main search row */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Sök efter företagsnamn..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-green-600"></div>
                    </div>
                  )}
                </div>

                {/* Mobile: Filter button */}
                <Button
                  variant="outline"
                  className="md:hidden relative"
                  onClick={() => setFilterDrawerOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>

                {/* Desktop: inline advanced filters */}
                <div className="hidden md:flex gap-4">
                  <Input
                    placeholder="Filtrera på ort..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-40 lg:w-48"
                  />
                  <Input
                    placeholder="Besöker område..."
                    value={visitingArea}
                    onChange={(e) => setVisitingArea(e.target.value)}
                    className="w-40 lg:w-48"
                  />
                </div>
                {(search || city || visitingArea || userLocation) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearFilters}
                    data-testid="clear-filters-button"
                    className="hidden md:flex"
                  >
                    Rensa
                  </Button>
                )}
              </div>

              {/* Desktop: Place Search (hidden on mobile -- inside drawer) */}
              <div className="hidden md:flex flex-col gap-3">
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
                      {isGeocoding ? "Söker..." : "Sök plats"}
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
                    <MapPin className="h-4 w-4 mr-2" />
                    {locationLoading ? "Hämtar position..." : "Använd min position"}
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
                      <option value={200}>200 km</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Location Error */}
              {locationError && (
                <p className="text-sm text-red-600">{locationError}</p>
              )}

              {/* Result count + sort + active filter chips */}
              {!isLoading && !isSearching && !error && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {providers.length === 0
                      ? "Inga träffar"
                      : `${providers.length} leverantör${providers.length !== 1 ? "er" : ""}`}
                  </p>
                  {providers.length > 1 && (
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="text-sm border rounded-md px-3 py-1.5 bg-white text-gray-700"
                    >
                      <option value="default">Sortera</option>
                      <option value="rating">Högst betyg</option>
                      <option value="reviews">Flest recensioner</option>
                    </select>
                  )}
                </div>
              )}

              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-green-600"></div>
                  <span>Söker...</span>
                </div>
              )}
              {!isSearching && (search || city || visitingArea || userLocation) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                  <span>Aktiva filter:</span>
                  {search && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-green-100 text-green-800 rounded-full">
                      Sökning: &quot;{search}&quot;
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("")
                          const geo = userLocation
                            ? { latitude: userLocation.lat, longitude: userLocation.lng, radiusKm }
                            : undefined
                          fetchProviders("", city, geo)
                        }}
                        className="hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {city && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-blue-100 text-blue-800 rounded-full">
                      Ort: &quot;{city}&quot;
                      <button
                        type="button"
                        onClick={() => {
                          setCity("")
                          const geo = userLocation
                            ? { latitude: userLocation.lat, longitude: userLocation.lng, radiusKm }
                            : undefined
                          fetchProviders(search, "", geo)
                        }}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {visitingArea && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-purple-100 text-purple-800 rounded-full">
                      Besöker: &quot;{visitingArea}&quot;
                      <button
                        type="button"
                        onClick={() => {
                          setVisitingArea("")
                          setVisitingProviders([])
                        }}
                        className="hover:text-purple-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {userLocation && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-orange-100 text-orange-800 rounded-full">
                      {searchPlaceName ? searchPlaceName : "Min position"}, inom {radiusKm} km
                      <button
                        type="button"
                        onClick={clearLocation}
                        className="hover:text-orange-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Filter Drawer */}
          <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filter</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Filtrera på ort</label>
                  <Input
                    placeholder="T.ex. Stockholm, Göteborg..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Besöker område</label>
                  <Input
                    placeholder="T.ex. Täby, Sollentuna..."
                    value={visitingArea}
                    onChange={(e) => setVisitingArea(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Sök i närheten</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ort eller postnummer..."
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
                      {isGeocoding ? "Söker..." : "Sök"}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={requestLocation}
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    disabled={locationLoading}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {locationLoading ? "Hämtar..." : "Min position"}
                  </Button>
                  {userLocation && (
                    <select
                      value={radiusKm}
                      onChange={(e) => handleRadiusChange(Number(e.target.value))}
                      className="border rounded-md px-3 py-2 touch-target text-sm bg-white"
                    >
                      <option value={25}>25 km</option>
                      <option value={50}>50 km</option>
                      <option value={100}>100 km</option>
                      <option value={200}>200 km</option>
                    </select>
                  )}
                </div>
                {locationError && (
                  <p className="text-sm text-red-600">{locationError}</p>
                )}
                <div className="flex gap-3 pt-2">
                  {(city || visitingArea || userLocation) && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        handleClearFilters()
                        setFilterDrawerOpen(false)
                      }}
                    >
                      Rensa filter
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    onClick={() => setFilterDrawerOpen(false)}
                  >
                    Visa resultat
                  </Button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Visiting Providers Section */}
          {visitingArea && visitingProviders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-purple-800">
                Leverantörer som besöker {visitingArea}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visitingProviders.map(({ provider, nextVisit }) => (
                  <Card
                    key={provider.id}
                    className="hover:shadow-lg transition-shadow border-purple-200 bg-purple-50"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{provider.businessName}</CardTitle>
                          <CardDescription>
                            {provider.city && `${provider.city} • `}
                            {provider.user.firstName} {provider.user.lastName}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-purple-100 rounded-md">
                        <p className="text-sm font-medium text-purple-800">
                          Nästa besök i {nextVisit.location}:
                        </p>
                        <p className="text-sm text-purple-700">
                          {new Date(nextVisit.date + "T00:00:00").toLocaleDateString("sv-SE", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                          {nextVisit.startTime && nextVisit.endTime && (
                            <span className="ml-1">
                              kl {nextVisit.startTime} - {nextVisit.endTime}
                            </span>
                          )}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {provider.services.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            Tjänster:
                          </p>
                          <div className="space-y-1">
                            {provider.services.slice(0, 2).map((service) => (
                              <div
                                key={service.id}
                                className="text-sm flex justify-between"
                              >
                                <span>{service.name}</span>
                                <span className="text-gray-600">
                                  {service.price} kr
                                </span>
                              </div>
                            ))}
                            {provider.services.length > 2 && (
                              <p className="text-xs text-gray-500">
                                +{provider.services.length - 2} fler tjänster
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <Link href={`/providers/${provider.id}`}>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700">
                          Se profil & boka
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {visitingArea && visitingProviders.length === 0 && !isSearching && (
            <Card className="mb-8 border-purple-200">
              <CardContent className="py-6 text-center">
                <p className="text-gray-600">
                  Inga leverantörer har planerade besök i "{visitingArea}" just nu.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Providers List */}
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Något gick fel
                </h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={() => {
                  const geo = userLocation
                    ? { latitude: userLocation.lat, longitude: userLocation.lng, radiusKm }
                    : undefined
                  fetchProviders(search, city, geo)
                }}>
                  Försök igen
                </Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <ProviderCardSkeleton count={6} />
          ) : providers.length === 0 ? (
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Inga leverantörer hittades
                </h3>
                <p className="text-gray-600 mb-6">
                  {search || city || userLocation ? (
                    <>
                      Prova att ändra dina sökfilter eller{" "}
                      <button
                        onClick={handleClearFilters}
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        rensa alla filter
                      </button>
                    </>
                  ) : (
                    "Det finns inga leverantörer tillgängliga just nu. Kom tillbaka senare!"
                  )}
                </p>
                {user && user.userType === "provider" && !search && !city && !userLocation && (
                  <p className="text-sm text-gray-500">
                    Tips: Se till att din profil är komplett och att du har skapat minst en tjänst för att synas här.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProviders.map((provider, index) => (
                <Card key={provider.id} className="animate-fade-in-up hover:shadow-lg transition-shadow" data-testid="provider-card" style={{ animationDelay: `${index * 50}ms` }}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {provider.profileImageUrl ? (
                        <img
                          src={provider.profileImageUrl}
                          alt={provider.businessName}
                          className="h-12 w-12 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-green-700 font-semibold text-lg">
                            {provider.businessName.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="truncate">{provider.businessName}</CardTitle>
                        <CardDescription>
                          {provider.city && `${provider.city} • `}
                          {provider.user.firstName} {provider.user.lastName}
                        </CardDescription>
                      </div>
                    </div>
                    {provider.reviewStats && provider.reviewStats.totalCount > 0 && provider.reviewStats.averageRating !== null && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <StarRating rating={Math.round(provider.reviewStats.averageRating)} readonly size="sm" />
                        <span className="text-sm font-medium">{provider.reviewStats.averageRating.toFixed(1)}</span>
                        <span className="text-sm text-gray-500">
                          ({provider.reviewStats.totalCount})
                        </span>
                      </div>
                    )}
                    {provider.nextVisit && (
                      <div className="mt-2 text-sm text-purple-600">
                        Nästa besök: {provider.nextVisit.location} - {formatShortDate(provider.nextVisit.date)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {provider.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {provider.description}
                      </p>
                    )}

                    {provider.services.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Tjänster:
                        </p>
                        <div className="space-y-1">
                          {provider.services.slice(0, 3).map((service) => (
                            <div
                              key={service.id}
                              className="text-sm flex justify-between"
                            >
                              <span>{service.name}</span>
                              <span className="text-gray-600">
                                {service.price} kr
                              </span>
                            </div>
                          ))}
                          {provider.services.length > 3 && (
                            <p className="text-xs text-gray-500">
                              +{provider.services.length - 3} fler tjänster
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <Link href={`/providers/${provider.id}`}>
                      <Button className="w-full">Se profil & boka</Button>
                    </Link>
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
