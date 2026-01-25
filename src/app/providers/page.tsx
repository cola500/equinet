"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { Header } from "@/components/layout/Header"

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
}

export default function ProvidersPage() {
  const { user } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [search, setSearch] = useState("")
  const [city, setCity] = useState("")
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
        const data = await response.json()
        setProviders(data)
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
    fetchProviders()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Hitta tjänsteleverantörer</h1>
          <p className="text-gray-600 mb-8">
            Bläddra bland professionella hovslagare, veterinärer och andra hästtjänster
          </p>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Sök efter företagsnamn eller beskrivning..."
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
                <Input
                  placeholder="Filtrera på ort..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-64"
                />
                {(search || city) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearFilters}
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
              {!isSearching && (search || city) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
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
                </div>
              )}
            </div>
          </div>

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
