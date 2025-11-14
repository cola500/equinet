"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

export default function ProviderDashboard() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [error, setError] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchData()
    }
  }, [isProvider])

  const fetchData = async () => {
    setIsLoadingData(true)
    setError(null)
    try {
      await Promise.all([fetchServices(), fetchBookings()])
    } catch (error) {
      console.error("Error fetching data:", error)
      setError("Kunde inte hämta data. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingData(false)
    }
  }

  const fetchServices = async () => {
    const response = await fetch("/api/services")
    if (response.ok) {
      const data = await response.json()
      setServices(data)
    } else {
      throw new Error("Failed to fetch services")
    }
  }

  const fetchBookings = async () => {
    const response = await fetch("/api/bookings")
    if (response.ok) {
      const data = await response.json()
      setBookings(data)
    } else {
      throw new Error("Failed to fetch bookings")
    }
  }

  if (isLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-8">Välkommen tillbaka!</h1>

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
              <Button onClick={fetchData}>Försök igen</Button>
            </CardContent>
          </Card>
        ) : isLoadingData ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar dashboard...</p>
          </div>
        ) : (
          <>
            {/* Onboarding Checklist for new providers */}
            {services.length === 0 && bookings.length === 0 && (
              <Card className="mb-8 border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Välkommen till Equinet!
                  </CardTitle>
                  <CardDescription>
                    Kom igång med din leverantörsprofil genom att följa dessa steg
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Komplettera din profil</h4>
                        <p className="text-sm text-gray-600">
                          Lägg till information om ditt företag, kontaktuppgifter och en beskrivning.
                        </p>
                        <Link href="/provider/profile">
                          <Button size="sm" variant="link" className="px-0">
                            Gå till profil →
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-semibold">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Skapa din första tjänst</h4>
                        <p className="text-sm text-gray-600">
                          Lägg till de tjänster du erbjuder med pris och varaktighet.
                        </p>
                        <Link href="/provider/services">
                          <Button size="sm" variant="link" className="px-0">
                            Skapa tjänst →
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg opacity-60">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-semibold">
                        3
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">Vänta på bokningar</h4>
                        <p className="text-sm text-gray-600">
                          När kunder hittar dig kommer bokningar visas under "Bokningar".
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Stats Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Aktiva tjänster
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {services.filter((s: any) => s.isActive).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Kommande bokningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {bookings.filter((b: any) =>
                  (b.status === "pending" || b.status === "confirmed") &&
                  new Date(b.bookingDate) >= new Date()
                ).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Nya förfrågningar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {bookings.filter((b: any) => b.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Snabblänkar</CardTitle>
            <CardDescription>Vanliga åtgärder</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/provider/services">
                <Button className="w-full" variant="outline">
                  Hantera tjänster
                </Button>
              </Link>
              <Link href="/provider/bookings">
                <Button className="w-full" variant="outline">
                  Se bokningar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Services */}
        {services.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dina tjänster</CardTitle>
              <CardDescription>
                {services.length} tjänster registrerade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.slice(0, 3).map((service: any) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-sm text-gray-600">
                        {service.durationMinutes} min • {service.price} kr
                      </p>
                    </div>
                    <div>
                      {service.isActive ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Aktiv
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          Inaktiv
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {services.length > 3 && (
                <div className="mt-4">
                  <Link href="/provider/services">
                    <Button variant="link">Se alla tjänster →</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {services.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">
                Du har inga tjänster ännu. Skapa din första tjänst för att komma igång!
              </p>
              <Link href="/provider/services">
                <Button>Skapa tjänst</Button>
              </Link>
            </CardContent>
          </Card>
        )}
          </>
        )}
    </ProviderLayout>
  )
}
