"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"

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

  useEffect(() => {
    fetchProviders()
  }, [])

  // Debounce search - sök automatiskt efter 500ms av inaktivitet
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProviders(search, city)
    }, 500)

    return () => clearTimeout(timer)
  }, [search, city])

  const fetchProviders = async (searchQuery?: string, cityQuery?: string) => {
    try {
      setIsLoading(true)
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
      }
    } catch (error) {
      console.error("Error fetching providers:", error)
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
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-green-800">
            Equinet
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-sm">
                    {user.name}
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <Link href="/customer/bookings">
                    <DropdownMenuItem className="cursor-pointer">
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Mina bokningar
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/customer/profile">
                    <DropdownMenuItem className="cursor-pointer">
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Min profil
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600"
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logga ut
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Logga in</Button>
                </Link>
                <Link href="/register">
                  <Button>Registrera</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

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
                <Input
                  placeholder="Sök efter företagsnamn eller beskrivning..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1"
                />
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
              {(search || city) && (
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
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Laddar leverantörer...</p>
            </div>
          ) : providers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-600">
                  Inga leverantörer hittades. Prova en annan sökning.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:shadow-lg transition-shadow">
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
