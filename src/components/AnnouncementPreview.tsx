"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface RouteStop {
  locationName: string | null
  address: string
}

interface Announcement {
  id: string
  serviceType: string
  dateFrom: string
  dateTo: string
  provider: {
    businessName: string
  }
  routeStops: RouteStop[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  })
}

function formatDateRange(dateFrom: string, dateTo: string): string {
  const from = formatDate(dateFrom)
  const to = formatDate(dateTo)

  if (from === to) {
    return from
  }
  return `${from} - ${to}`
}

function getServiceTypeLabel(serviceType: string): string {
  const labels: Record<string, string> = {
    farrier: "Hovslagare",
    veterinarian: "Veterinär",
    therapist: "Hästterapeut",
    dentist: "Hästtandvård",
    transport: "Hästtransport",
    instructor: "Ridinstruktör",
  }
  return labels[serviceType] || serviceType
}

function getLocationSummary(routeStops: RouteStop[]): string {
  if (routeStops.length === 0) {
    return "Inga platser angivna"
  }

  const locations = routeStops
    .map(stop => stop.locationName || stop.address)
    .filter(Boolean)
    .slice(0, 3)

  if (locations.length === 0) {
    return "Inga platser angivna"
  }

  if (routeStops.length > 3) {
    return `${locations.join(", ")} +${routeStops.length - 3} till`
  }

  return locations.join(", ")
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <Link href={`/announcements/${announcement.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-1">
              {announcement.provider.businessName}
            </CardTitle>
            <Badge variant="secondary" className="shrink-0">
              {getServiceTypeLabel(announcement.serviceType)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <svg
              className="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {formatDateRange(announcement.dateFrom, announcement.dateTo)}
          </div>
          <div className="flex items-start text-sm text-gray-600">
            <svg
              className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0"
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
            <span className="line-clamp-2">
              {getLocationSummary(announcement.routeStops)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function LoadingSkeleton() {
  return (
    <section className="mt-32">
      <div className="h-9 w-64 bg-gray-200 rounded mx-auto mb-4 animate-pulse" />
      <div className="h-6 w-96 bg-gray-100 rounded mx-auto mb-12 animate-pulse" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </section>
  )
}

export function AnnouncementPreview() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/route-orders/announcements")
      .then(res => res.json())
      .then(data => {
        // Hantera både array och error-response
        if (Array.isArray(data)) {
          setAnnouncements(data.slice(0, 6))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (announcements.length === 0) return null

  return (
    <section className="mt-32">
      <h2 className="text-3xl font-bold text-center mb-4">
        Aktuella rutter
      </h2>
      <p className="text-center text-gray-600 mb-12">
        Leverantörer som planerar besök i olika områden
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {announcements.map(announcement => (
          <AnnouncementCard key={announcement.id} announcement={announcement} />
        ))}
      </div>

      <div className="text-center mt-8">
        <Link href="/announcements">
          <Button variant="outline" size="lg">
            Se alla rutter
          </Button>
        </Link>
      </div>
    </section>
  )
}
