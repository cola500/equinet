"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { clientLogger } from "@/lib/client-logger"
import { format, isPast } from "date-fns"
import { sv } from "date-fns/locale"
import { ChevronLeft } from "lucide-react"

interface SeriesBooking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
}

interface BookingSeries {
  id: string
  intervalWeeks: number
  totalOccurrences: number
  createdCount: number
  startTime: string
  status: string
  cancelledAt: string | null
  service: {
    name: string
    price: number
    durationMinutes: number
  }
  horse: { name: string } | null
  provider: { businessName: string }
  bookings: SeriesBooking[]
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Väntar på svar",
  confirmed: "Bekräftad",
  cancelled: "Avbokad",
  completed: "Genomförd",
  no_show: "Ej infunnit",
}

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-orange-100 text-orange-800",
}

export default function BookingSeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [series, setSeries] = useState<BookingSeries | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  useEffect(() => {
    if (!isCustomer) return
    const fetchSeries = async () => {
      try {
        const response = await fetch(`/api/booking-series/${id}`)
        if (response.status === 404) {
          toast.error("Bokningsserien hittades inte")
          router.push("/customer/bookings")
          return
        }
        if (!response.ok) {
          toast.error("Kunde inte hämta bokningsserien")
          return
        }
        const data = await response.json()
        setSeries(data)
      } catch (error) {
        clientLogger.error("Error fetching booking series:", error)
        toast.error("Kunde inte hämta bokningsserien")
      } finally {
        setIsLoading(false)
      }
    }
    fetchSeries()
  }, [id, isCustomer, router])

  const handleCancelSeries = async () => {
    setIsCancelling(true)
    try {
      const response = await fetch(`/api/booking-series/${id}/cancel`, {
        method: "POST",
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte avboka serien")
      }
      toast.success("Bokningsserien har avbokats")
      setCancelDialogOpen(false)
      router.push("/customer/bookings")
    } catch (error) {
      clientLogger.error("Error cancelling booking series:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte avboka serien")
    } finally {
      setIsCancelling(false)
    }
  }

  if (authLoading || !isCustomer) {
    return (
      <CustomerLayout>
        <div role="status" aria-label="Laddar" className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
        </div>
      </CustomerLayout>
    )
  }

  if (isLoading || !series) {
    return (
      <CustomerLayout>
        <div role="status" aria-label="Laddar bokningsserie" className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
          <p className="mt-2 text-gray-600">Laddar bokningsserie...</p>
        </div>
      </CustomerLayout>
    )
  }

  const isCancelled = series.status === "cancelled"
  const canCancel = !isCancelled && series.bookings.some(
    (b) => b.status === "pending" || b.status === "confirmed"
  )
  const intervalLabel = series.intervalWeeks === 1
    ? "varje vecka"
    : `var ${series.intervalWeeks}:e vecka`

  const upcomingBookings = series.bookings.filter((b) => !isPast(new Date(b.bookingDate)) || b.status === "pending" || b.status === "confirmed")
  const pastBookings = series.bookings.filter((b) => isPast(new Date(b.bookingDate)) && b.status !== "pending" && b.status !== "confirmed")

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto">
        {/* Back navigation */}
        <Link
          href="/customer/bookings"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Mina bokningar
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{series.service.name}</h1>
            <p className="text-gray-600 mt-0.5">{series.provider.businessName}</p>
            {series.horse && (
              <p className="text-gray-500 text-sm mt-0.5">{series.horse.name}</p>
            )}
            <p className="text-gray-600 mt-1 text-sm">
              {series.createdCount} tillfällen &middot; {intervalLabel}
            </p>
          </div>
          {isCancelled ? (
            <Badge className="bg-red-100 text-red-800 shrink-0">Avbokad</Badge>
          ) : (
            <Badge className="bg-purple-100 text-purple-800 shrink-0">Aktiv</Badge>
          )}
        </div>

        {/* Series info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Seriedetaljer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Pris per tillfälle</span>
              <p className="font-medium">{series.service.price} kr</p>
            </div>
            <div>
              <span className="text-gray-500">Varaktighet</span>
              <p className="font-medium">{series.service.durationMinutes} min</p>
            </div>
            <div>
              <span className="text-gray-500">Klockslag</span>
              <p className="font-medium">{series.startTime}</p>
            </div>
            <div>
              <span className="text-gray-500">Intervall</span>
              <p className="font-medium capitalize">{intervalLabel}</p>
            </div>
          </CardContent>
        </Card>

        {/* Booking dates */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Datum i serien</CardTitle>
          </CardHeader>
          <CardContent>
            {series.bookings.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Inga bokningar i serien.</p>
            ) : (
              <div className="space-y-1">
                {upcomingBookings.length > 0 && (
                  <>
                    {pastBookings.length > 0 && (
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pb-1">Kommande</p>
                    )}
                    {upcomingBookings.map((booking, i) => (
                      <BookingDateRow
                        key={booking.id}
                        booking={booking}
                        index={pastBookings.length + i}
                        dimmed={false}
                      />
                    ))}
                  </>
                )}
                {pastBookings.length > 0 && (
                  <>
                    {upcomingBookings.length > 0 && (
                      <div className="pt-3 mt-2 border-t">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pb-1">Tidigare</p>
                      </div>
                    )}
                    {pastBookings.length > 0 && upcomingBookings.length === 0 && (
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pb-1">Tidigare</p>
                    )}
                    {pastBookings.map((booking, i) => (
                      <BookingDateRow
                        key={booking.id}
                        booking={booking}
                        index={i}
                        dimmed
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/customer/bookings")}
          >
            Tillbaka till bokningar
          </Button>
        </div>

        {canCancel && (
          <div className="mt-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 w-full sm:w-auto"
              onClick={() => setCancelDialogOpen(true)}
            >
              Avboka hela serien
            </Button>
          </div>
        )}

        {/* Cancel dialog */}
        {cancelDialogOpen && (
          <ResponsiveAlertDialog open={true} onOpenChange={(open) => { if (!open) setCancelDialogOpen(false) }}>
            <ResponsiveAlertDialogContent>
              <ResponsiveAlertDialogHeader>
                <ResponsiveAlertDialogTitle>Avboka hela serien?</ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  Alla kommande bokningar i serien avbokas. Du kan inte ångra detta.
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel
                  disabled={isCancelling}
                  onClick={() => setCancelDialogOpen(false)}
                >
                  Nej, behåll serien
                </ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogAction
                  onClick={handleCancelSeries}
                  disabled={isCancelling}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isCancelling ? "Avbokar..." : "Ja, avboka serien"}
                </ResponsiveAlertDialogAction>
              </ResponsiveAlertDialogFooter>
            </ResponsiveAlertDialogContent>
          </ResponsiveAlertDialog>
        )}
      </div>
    </CustomerLayout>
  )
}

function BookingDateRow({
  booking,
  index,
  dimmed,
}: {
  booking: SeriesBooking
  index: number
  dimmed: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 border-b last:border-0 ${dimmed ? "opacity-50" : ""}`}
      aria-label={`Tillfälle ${index + 1}: ${format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv })}, ${BOOKING_STATUS_LABELS[booking.status] || booking.status}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 w-5 text-right shrink-0">{index + 1}.</span>
        <div>
          <p className="text-sm font-medium">
            {format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv })}
          </p>
          <p className="text-xs text-gray-500">
            {booking.startTime}&ndash;{booking.endTime}
          </p>
        </div>
      </div>
      <span
        className={`text-xs px-2 py-1 rounded shrink-0 ${BOOKING_STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-800"}`}
      >
        {BOOKING_STATUS_LABELS[booking.status] || booking.status}
      </span>
    </div>
  )
}
