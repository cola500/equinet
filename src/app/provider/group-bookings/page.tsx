"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface GroupBookingParticipant {
  id: string
  userId: string
  numberOfHorses: number
  status: string
  user: { firstName: string }
}

interface GroupBookingRequest {
  id: string
  serviceType: string
  locationName: string
  address: string
  dateFrom: string
  dateTo: string
  maxParticipants: number
  status: string
  notes: string | null
  participants: GroupBookingParticipant[]
  _count: { participants: number }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  })
}

export default function ProviderGroupBookingsPage() {
  const router = useRouter()
  const { isLoading: authLoading, isProvider } = useAuth()
  const [groupBookings, setGroupBookings] = useState<GroupBookingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  const fetchAvailable = useCallback(async () => {
    try {
      const response = await fetch("/api/group-bookings/available")
      if (response.ok) {
        const data = await response.json()
        setGroupBookings(data)
      } else {
        toast.error("Kunde inte hämta grupprequests")
      }
    } catch (error) {
      console.error("Error fetching available group bookings:", error)
      toast.error("Kunde inte hämta grupprequests")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isProvider) {
      fetchAvailable()
    }
  }, [isProvider, fetchAvailable])

  if (authLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  const totalHorses = (gb: GroupBookingRequest) =>
    gb.participants.reduce((sum, p) => sum + p.numberOfHorses, 0)

  return (
    <ProviderLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Öppna grupprequests</h1>
        <p className="text-gray-600 mt-2">
          Stallgemenskaper som söker leverantör. Matcha för att skapa bokningar
          för alla deltagare.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar grupprequests...</p>
        </div>
      ) : groupBookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">
              Inga öppna grupprequests just nu.
            </p>
            <p className="text-sm text-gray-500">
              När hästägare skapar grupprequests i ditt område visas de här.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groupBookings.map((gb) => (
            <Link key={gb.id} href={`/provider/group-bookings/${gb.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{gb.serviceType}</CardTitle>
                    <Badge className="bg-green-100 text-green-800">
                      {gb._count.participants} deltagare
                    </Badge>
                  </div>
                  <CardDescription>
                    {gb.locationName} &middot; {formatDate(gb.dateFrom)} &ndash;{" "}
                    {formatDate(gb.dateTo)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {totalHorses(gb)} {totalHorses(gb) === 1 ? "häst" : "hästar"} totalt
                    </span>
                    <span>{gb.address}</span>
                  </div>
                  {gb.notes && (
                    <p className="text-sm text-gray-500 mt-2 truncate">
                      {gb.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </ProviderLayout>
  )
}
