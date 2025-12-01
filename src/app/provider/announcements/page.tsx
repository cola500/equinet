"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface RouteStop {
  id: string
  locationName: string
  address: string
  stopOrder: number
}

interface Announcement {
  id: string
  serviceType: string
  address: string
  dateFrom: string
  dateTo: string
  status: string
  specialInstructions?: string
  routeStops: RouteStop[]
  _count?: {
    bookings: number
  }
}

export default function ProviderAnnouncementsPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchAnnouncements()
    }
  }, [isProvider])

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch("/api/route-orders?announcementType=provider_announced")
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data)
      }
    } catch (error) {
      console.error("Error fetching announcements:", error)
      toast.error("Kunde inte hämta rutt-annonser")
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm("Är du säker på att du vill avbryta denna rutt-annons?")) {
      return
    }

    try {
      const response = await fetch(`/api/route-orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        throw new Error("Failed to cancel announcement")
      }

      toast.success("Rutt-annons avbruten!")
      fetchAnnouncements()
    } catch (error) {
      console.error("Error cancelling announcement:", error)
      toast.error("Kunde inte avbryta rutt-annons")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800"
      case "in_route":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-gray-100 text-gray-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "Öppen"
      case "in_route":
        return "På rutt"
      case "completed":
        return "Genomförd"
      case "cancelled":
        return "Avbruten"
      default:
        return status
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mina rutt-annonser</h1>
          <p className="text-gray-600 mt-1">
            Hantera dina planerade rutter och se bokningar
          </p>
        </div>
        <Button onClick={() => router.push("/provider/announcements/new")}>
          Skapa ny rutt-annons
        </Button>
      </div>

      {announcements.length === 0 ? (
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
              Inga rutt-annonser ännu
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Skapa din första rutt-annons för att låta kunder boka sig längs din planerade väg.
              Detta sparar tid och optimerar din körrutt!
            </p>
            <Button onClick={() => router.push("/provider/announcements/new")} size="lg">
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Skapa din första rutt-annons
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{announcement.serviceType}</CardTitle>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(announcement.status)}`}>
                        {getStatusText(announcement.status)}
                      </span>
                    </div>
                    <CardDescription className="mt-2">
                      {formatDate(announcement.dateFrom)} - {formatDate(announcement.dateTo)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Route Stops */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Platser:</h4>
                    <div className="space-y-2">
                      {announcement.routeStops.map((stop) => (
                        <div key={stop.id} className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-gray-600">
                            {stop.stopOrder}.
                          </span>
                          <span className="font-medium">{stop.locationName}</span>
                          <span className="text-gray-500">• {stop.address}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Special Instructions */}
                  {announcement.specialInstructions && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Information:</h4>
                      <p className="text-sm text-gray-600">{announcement.specialInstructions}</p>
                    </div>
                  )}

                  {/* Bookings Count */}
                  {announcement._count && (
                    <div className="pt-2 border-t">
                      <span className="text-sm text-gray-600">
                        {announcement._count.bookings} bokningar
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {announcement.status === "open" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => router.push(`/provider/announcements/${announcement.id}`)}
                        variant="outline"
                        size="sm"
                      >
                        Visa detaljer
                      </Button>
                      <Button
                        onClick={() => handleCancel(announcement.id)}
                        variant="destructive"
                        size="sm"
                      >
                        Avbryt rutt
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ProviderLayout>
  )
}
