"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { Header } from "@/components/layout/Header"
import { StarRating } from "@/components/review/StarRating"
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
  const { user } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [visitingProviders, setVisitingProviders] = useState<ProviderWithVisit[]>([])
  const [search, setSearch] = useState("")
  const [city, setCity] = useState("")
  const [visitingArea, setVisitingArea] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders()
  }, [])

  // Debounce search - sök automatiskt efter 500ms av inaktivitet
  useEffect(() => {
    // Show searching indicator immediately
    if (search || city) {
      setIsSearching(true)
    }

    const timer = setTimeout(() => {
      fetchProviders(search, city)
      setIsSearching(false)
    }, 500)

    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [search, city])

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

  const fetchProviders = async (searchQuery?: string, cityQuery?: string) => {
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

      const url = params.toString()
        ? `/api/providers?${params.toString()}`
        : "/api/providers"

      const response = await fetch(url)
      if (response.ok) {
        const result = await response.json()
        // API returns { data: Provider[], pagination: {...} }
        setProviders(result.data)
      } else {
        setError("Kunde inte hämta leverantörer")
      }
    } catch (error) {
      console.error("Error fetching providers:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProviders(search, city)
  }

  const handleClearFilters = () => {
    setSearch("")
    setCity("")
    setVisitingArea("")
    setVisitingProviders([])
    fetchProviders()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-4xl font-bold mb-2">Hitta tjänsteleverantörer</h1>
          <p className="text-gray-600 mb-8">
            Bläddra bland professionella hovslagare, veterinärer och andra hästtjänster
          </p>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Sök efter företagsnamn..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-11"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-green-600"></div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 md:gap-4">
                  <Input
                    placeholder="Filtrera på ort..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full md:w-40 lg:w-48 h-11"
                  />
                  <Input
                    placeholder="Besöker område..."
                    value={visitingArea}
                    onChange={(e) => setVisitingArea(e.target.value)}
                    className="w-full md:w-40 lg:w-48 h-11"
                  />
                </div>
                {(search || city || visitingArea) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearFilters}
                    data-testid="clear-filters-button"
                    className="h-11 w-full md:w-auto"
                  >
                    Rensa
                  </Button>
                )}
              </div>
              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-green-600"></div>
                  <span>Söker...</span>
                </div>
              )}
              {!isSearching && (search || city || visitingArea) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                  <span>Aktiva filter:</span>
                  {search && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                      Sökning: "{search}"
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("")
                          fetchProviders("", city)
                        }}
                        className="hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {city && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                      Ort: "{city}"
                      <button
                        type="button"
                        onClick={() => {
                          setCity("")
                          fetchProviders(search, "")
                        }}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {visitingArea && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                      Besöker: "{visitingArea}"
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
                </div>
              )}
            </div>
          </div>

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
                <Button onClick={() => fetchProviders(search, city)}>
                  Försök igen
                </Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Laddar leverantörer...</p>
            </div>
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
                  {search || city ? (
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
                {user && user.userType === "provider" && !search && !city && (
                  <p className="text-sm text-gray-500">
                    Tips: Se till att din profil är komplett och att du har skapat minst en tjänst för att synas här.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:shadow-lg transition-shadow" data-testid="provider-card">
                  <CardHeader>
                    <CardTitle>{provider.businessName}</CardTitle>
                    <CardDescription>
                      {provider.city && `${provider.city} • `}
                      {provider.user.firstName} {provider.user.lastName}
                    </CardDescription>
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
