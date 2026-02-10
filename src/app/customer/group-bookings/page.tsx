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
import { CustomerLayout } from "@/components/layout/CustomerLayout"

interface GroupBookingParticipant {
  id: string
  userId: string
  numberOfHorses: number
  status: string
  user: { firstName: string }
}

interface GroupBookingRequest {
  id: string
  creatorId: string
  serviceType: string
  locationName: string
  address: string
  dateFrom: string
  dateTo: string
  maxParticipants: number
  status: string
  inviteCode: string
  notes: string | null
  createdAt: string
  participants: GroupBookingParticipant[]
  _count: { participants: number }
}

const STATUS_LABELS: Record<string, string> = {
  open: "Öppen",
  matched: "Matchad",
  completed: "Slutförd",
  cancelled: "Avbruten",
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  matched: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  })
}

export default function CustomerGroupBookingsPage() {
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [groupBookings, setGroupBookings] = useState<GroupBookingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const fetchGroupBookings = useCallback(async () => {
    try {
      const response = await fetch("/api/group-bookings")
      if (response.ok) {
        const data = await response.json()
        setGroupBookings(data)
      } else {
        toast.error("Kunde inte hämta gruppbokningar")
      }
    } catch (error) {
      console.error("Error fetching group bookings:", error)
      toast.error("Kunde inte hämta gruppbokningar")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isCustomer) {
      fetchGroupBookings()
    }
  }, [isCustomer, fetchGroupBookings])

  if (authLoading || !isCustomer) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold">Gruppbokningar</h1>
        <Link href="/customer/group-bookings/new">
          <Button className="w-full sm:w-auto">Skapa grupprequest</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar gruppbokningar...</p>
        </div>
      ) : groupBookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">
              Du har inga gruppbokningar ännu.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Skapa en grupprequest för att samordna leverantörsbesök med andra
              hästägare i ditt stall.
            </p>
            <Link href="/customer/group-bookings/new">
              <Button>Skapa din första grupprequest</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groupBookings.map((gb) => (
            <Link key={gb.id} href={`/customer/group-bookings/${gb.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{gb.serviceType}</CardTitle>
                    <Badge className={STATUS_COLORS[gb.status] || "bg-gray-100"}>
                      {STATUS_LABELS[gb.status] || gb.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {gb.locationName} &middot; {formatDate(gb.dateFrom)} &ndash; {formatDate(gb.dateTo)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {gb._count.participants} / {gb.maxParticipants} deltagare
                    </span>
                    <span className="text-xs text-gray-400">
                      Kod: {gb.inviteCode}
                    </span>
                  </div>
                  {gb.participants.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      {gb.participants.map((p) => p.user.firstName).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </CustomerLayout>
  )
}
