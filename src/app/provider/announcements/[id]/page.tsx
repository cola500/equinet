"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface Booking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  customer: {
    id: string
    name: string
    email: string
    phone?: string
  }
  service: {
    id: string
    name: string
    price: number
    durationMinutes: number
  }
  createdAt: string
}

interface AnnouncementData {
  announcement: {
    id: string
    serviceType: string
    dateFrom: string
    dateTo: string
    status: string
  }
  bookings: Booking[]
  totalBookings: number
}

export default function AnnouncementDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { isLoading, isProvider } = useAuth()
  const [data, setData] = useState<AnnouncementData | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const announcementId = params.id as string

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider && announcementId) {
      fetchAnnouncementDetails()
    }
  }, [isProvider, announcementId])

  const fetchAnnouncementDetails = async () => {
    try {
      setPageLoading(true)
      setError(null)

      const response = await fetch(`/api/route-orders/${announcementId}/bookings`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Kunde inte hämta annons")
      }

      const announcementData = await response.json()
      setData(announcementData)
    } catch (err) {
      console.error("Error fetching announcement:", err)
      setError(err instanceof Error ? err.message : "Något gick fel")
      toast.error("Kunde inte hämta annons-detaljer")
    } finally {
      setPageLoading(false)
    }
  }

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Kunde inte uppdatera bokning")
      }

      toast.success(
        newStatus === "confirmed" ? "Bokning bekräftad!" : "Bokning avbokad"
      )
      fetchAnnouncementDetails()
    } catch (err) {
      console.error("Error updating booking:", err)
      toast.error("Kunde inte uppdatera bokning")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("sv-SE", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Väntar"
      case "confirmed":
        return "Bekräftad"
      case "cancelled":
        return "Avbokad"
      case "completed":
        return "Genomförd"
      default:
        return status
    }
  }

  if (isLoading || !isProvider || pageLoading) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  if (error) {
    return (
      <ProviderLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Något gick fel
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/provider/announcements")}>
              Tillbaka till annonser
            </Button>
          </CardContent>
        </Card>
      </ProviderLayout>
    )
  }

  if (!data) {
    return null
  }

  return (
    <ProviderLayout>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/provider/announcements"
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          &larr; Tillbaka till annonser
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{data.announcement.serviceType}</h1>
            <p className="text-gray-600 mt-1">
              {formatDate(data.announcement.dateFrom)} - {formatDate(data.announcement.dateTo)}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            data.announcement.status === "open"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}>
            {data.announcement.status === "open" ? "Öppen" : data.announcement.status}
          </span>
        </div>
      </div>

      {/* Summary */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-2xl font-bold">{data.totalBookings}</span>
              <p className="text-sm text-gray-600">Bokningar totalt</p>
            </div>
            <div>
              <span className="text-2xl font-bold">
                {data.bookings.filter(b => b.status === "pending").length}
              </span>
              <p className="text-sm text-gray-600">Väntar på bekräftelse</p>
            </div>
            <div>
              <span className="text-2xl font-bold">
                {data.bookings.filter(b => b.status === "confirmed").length}
              </span>
              <p className="text-sm text-gray-600">Bekräftade</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <h2 className="text-xl font-semibold mb-4">Bokningar</h2>

      {data.bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Inga bokningar ännu
            </h3>
            <p className="text-gray-600">
              Kunderna kan nu boka sig på din rutt-annons.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{booking.customer.name}</CardTitle>
                    <CardDescription>
                      {formatDate(booking.bookingDate)} | {booking.startTime} - {booking.endTime}
                    </CardDescription>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(booking.status)}`}>
                    {getStatusText(booking.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Contact Info */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-1">Kontaktinfo</h4>
                    <p>{booking.customer.email}</p>
                    {booking.customer.phone && <p>{booking.customer.phone}</p>}
                  </div>

                  {/* Service Info */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-1">Tjänst</h4>
                    <p>{booking.service.name}</p>
                    <p className="text-gray-600">{booking.service.price} kr • {booking.service.durationMinutes} min</p>
                  </div>

                  {/* Horse Info */}
                  {(booking.horseName || booking.horseInfo) && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Häst</h4>
                      {booking.horseName && <p>{booking.horseName}</p>}
                      {booking.horseInfo && <p className="text-gray-600">{booking.horseInfo}</p>}
                    </div>
                  )}

                  {/* Customer Notes */}
                  {booking.customerNotes && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">Kundens meddelande</h4>
                      <p className="text-gray-600">{booking.customerNotes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {booking.status === "pending" && (
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      onClick={() => handleUpdateBookingStatus(booking.id, "confirmed")}
                      size="sm"
                    >
                      Bekräfta
                    </Button>
                    <Button
                      onClick={() => handleUpdateBookingStatus(booking.id, "cancelled")}
                      variant="outline"
                      size="sm"
                    >
                      Avboka
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ProviderLayout>
  )
}
