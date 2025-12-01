"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"

interface RouteStop {
  id: string
  locationName: string
  address: string
  latitude: number
  longitude: number
  stopOrder: number
}

interface Announcement {
  id: string
  serviceType: string
  address: string
  latitude: number
  longitude: number
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
  const [location, setLocation] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async (filters?: { serviceType?: string; location?: string }) => {
    try {
      setIsLoading(true)
      setError(null)
      const params = new URLSearchParams()

      if (filters?.serviceType) {
        params.append("serviceType", filters.serviceType)
      }

      // Note: For MVP, we're not implementing geo-search yet
      // This would require user's location or manual address input

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
    fetchAnnouncements({ serviceType, location })
  }

  const handleClearFilters = () => {
    setServiceType("")
    setLocation("")
    fetchAnnouncements()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
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
            <Link href="/providers">
              <Button variant="ghost">Sök leverantörer</Button>
            </Link>
            {user ? (
              <Link href={user.userType === "provider" ? "/provider/dashboard" : "/customer/bookings"}>
                <Button>Min sida</Button>
              </Link>
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
          <h1 className="text-4xl font-bold mb-2">Planerade rutter</h1>
          <p className="text-gray-600 mb-8">
            Hitta leverantörer som är på väg i ditt område och boka direkt på deras rutt
          </p>

          {/* Search/Filter Section */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Filtrera på tjänstetyp (t.ex. Hovslagning)..."
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Plats (kommer snart)..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-64"
                  disabled
                />
                <Button onClick={handleSearch}>Sök</Button>
                {(serviceType || location) && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Rensa
                  </Button>
                )}
              </div>
              {serviceType && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Aktiva filter:</span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                    Tjänst: "{serviceType}"
                    <button
                      type="button"
                      onClick={() => {
                        setServiceType("")
                        fetchAnnouncements()
                      }}
                      className="hover:text-green-900"
                    >
                      ×
                    </button>
                  </span>
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
                  Inga planerade rutter just nu
                </h3>
                <p className="text-gray-600 mb-6">
                  {serviceType
                    ? "Inga rutter matchar dina sökfilter. Prova att ändra filtren."
                    : "Det finns inga planerade rutter tillgängliga just nu. Kom tillbaka senare!"}
                </p>
                <Link href="/providers">
                  <Button>Sök bland alla leverantörer istället</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
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
