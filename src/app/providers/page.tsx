"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async (searchQuery?: string) => {
    try {
      setIsLoading(true)
      const url = searchQuery
        ? `/api/providers?search=${encodeURIComponent(searchQuery)}`
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
    fetchProviders(search)
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
              <>
                <span className="text-sm text-gray-600">{user.name}</span>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">
                    Dashboard
                  </Button>
                </Link>
              </>
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
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-4">
              <Input
                placeholder="Sök efter företagsnamn eller tjänst..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Sök</Button>
            </div>
          </form>

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
