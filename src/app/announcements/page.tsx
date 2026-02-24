"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { MunicipalitySelect } from "@/components/ui/municipality-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RouteStop {
  id: string
  locationName: string
  address: string
  latitude?: number
  longitude?: number
  stopOrder: number
}

interface AnnouncementService {
  id: string
  name: string
  price?: number
}

interface Announcement {
  id: string
  serviceType: string
  address: string
  municipality?: string
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
  services?: AnnouncementService[]
}

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const routeAnnouncementsEnabled = useFeatureFlag("route_announcements")
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [municipality, setMunicipality] = useState("")
  const [serviceType, setServiceType] = useState("")

  // Fetch announcements on mount
  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async (filters?: {
    municipality?: string
    serviceType?: string
  }) => {
    try {
      setIsLoading(true)
      setError(null)
      const params = new URLSearchParams()

      if (filters?.municipality) {
        params.append("municipality", filters.municipality)
      }

      if (filters?.serviceType) {
        params.append("serviceType", filters.serviceType)
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
      municipality: municipality || undefined,
      serviceType: serviceType || undefined,
    })
  }

  const handleClearFilters = () => {
    setMunicipality("")
    setServiceType("")
    fetchAnnouncements()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const hasActiveFilters = municipality || serviceType

  if (!routeAnnouncementsEnabled) {
    return (
      <CustomerLayout>
        <div className="max-w-6xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold mb-2">Rutt-annonser</h1>
          <p className="text-gray-600">Rutt-annonser är inte tillgängliga just nu.</p>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Lediga tider i ditt område</h1>
          <p className="text-gray-600 mb-8">
            Hitta leverantörer som besöker din kommun och boka direkt
          </p>

          {/* Search/Filter Section */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              {/* Municipality Filter */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Kommun:</span>
                <div className="flex gap-2 items-start max-w-md">
                  <div className="flex-1">
                    <MunicipalitySelect
                      value={municipality}
                      onChange={(value) => {
                        setMunicipality(value)
                        // Auto-search when municipality is selected
                        if (value) {
                          fetchAnnouncements({
                            municipality: value,
                            serviceType: serviceType || undefined,
                          })
                        }
                      }}
                      placeholder="Sök kommun..."
                    />
                  </div>
                </div>
              </div>

              {/* Service Type Filter */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Tjänstetyp:</span>
                <div className="max-w-md">
                  <Select
                    value={serviceType}
                    onValueChange={(value) => {
                      const newValue = value === "__all__" ? "" : value
                      setServiceType(newValue)
                      fetchAnnouncements({
                        municipality: municipality || undefined,
                        serviceType: newValue || undefined,
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Alla tjänstetyper" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Alla tjänstetyper</SelectItem>
                      <SelectItem value="Hovslagning">Hovslagning</SelectItem>
                      <SelectItem value="Hovvård">Hovvård</SelectItem>
                      <SelectItem value="Massage">Massage</SelectItem>
                      <SelectItem value="Tandvård">Tandvård</SelectItem>
                      <SelectItem value="Veterinär">Veterinär</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 items-center">
                <Button onClick={handleSearch} size="sm" className="min-h-[44px] sm:min-h-0">Sök</Button>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" onClick={handleClearFilters}>
                    Rensa filter
                  </Button>
                )}
              </div>

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span>Aktiva filter:</span>
                  {municipality && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                      Kommun: {municipality}
                      <button
                        type="button"
                        aria-label="Ta bort filter kommun"
                        onClick={() => {
                          setMunicipality("")
                          fetchAnnouncements({
                            serviceType: serviceType || undefined,
                          })
                        }}
                        className="hover:text-blue-900"
                      >
                        x
                      </button>
                    </span>
                  )}
                  {serviceType && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                      Tjänst: &quot;{serviceType}&quot;
                      <button
                        type="button"
                        aria-label="Ta bort filter tjänst"
                        onClick={() => {
                          setServiceType("")
                          fetchAnnouncements({
                            municipality: municipality || undefined,
                          })
                        }}
                        className="hover:text-green-900"
                      >
                        x
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
                    : "Inga lediga tider just nu"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {hasActiveFilters
                    ? "Prova att välja en annan kommun eller rensa filtren."
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
                {municipality && ` i ${municipality}`}
              </p>

              {announcements.map((announcement) => (
                <Card key={announcement.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {announcement.provider.businessName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {announcement.serviceType} |{" "}
                          {formatDate(announcement.dateFrom)} - {formatDate(announcement.dateTo)}
                        </CardDescription>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium self-start">
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

                    {/* Municipality or Route Stops */}
                    <div className="mb-4">
                      {announcement.municipality ? (
                        <div className="flex items-center gap-2 text-sm">
                          <svg
                            className="h-4 w-4 text-gray-500 flex-shrink-0"
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
                          <span className="font-medium">{announcement.municipality}</span>
                        </div>
                      ) : announcement.routeStops.length > 0 ? (
                        <div>
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
                      ) : null}
                    </div>

                    {/* Services */}
                    {announcement.services && announcement.services.length > 0 && (
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-1">
                          {announcement.services.map((service) => (
                            <span
                              key={service.id}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                            >
                              {service.name}{service.price ? ` ${service.price} kr` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

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
                    <div className="flex flex-col gap-2 sm:flex-row pt-2">
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
    </CustomerLayout>
  )
}
