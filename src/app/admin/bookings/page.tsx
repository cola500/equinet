"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { ChevronLeft, ChevronRight } from "lucide-react"

interface AdminBooking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  isManualBooking: boolean
  customerName: string
  providerBusinessName: string
  serviceName: string
}

interface BookingsResponse {
  bookings: AdminBooking[]
  total: number
  page: number
  totalPages: number
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Väntande",
  confirmed: "Bekräftad",
  completed: "Genomförd",
  cancelled: "Avbokad",
  no_show: "Ej infunnit",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-800",
}

export default function AdminBookingsPage() {
  const [data, setData] = useState<BookingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [cancelBooking, setCancelBooking] = useState<AdminBooking | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("page", String(page))
    params.set("limit", "20")

    try {
      const res = await fetch(`/api/admin/bookings?${params}`)
      if (!res.ok) throw new Error("Fetch failed")
      const json = await res.json()
      setData(json)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [status, from, to, page])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleCancel = async () => {
    if (!cancelBooking || !cancelReason.trim()) return
    setCancelLoading(true)
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: cancelBooking.id,
          action: "cancel",
          reason: cancelReason.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Något gick fel")
        return
      }
      await fetchBookings()
    } catch {
      alert("Något gick fel")
    } finally {
      setCancelLoading(false)
      setCancelBooking(null)
      setCancelReason("")
    }
  }

  const canCancel = (booking: AdminBooking) =>
    booking.status === "pending" || booking.status === "confirmed"

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Bokningar</h1>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Alla statusar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla statusar</SelectItem>
              <SelectItem value="pending">Väntande</SelectItem>
              <SelectItem value="confirmed">Bekräftade</SelectItem>
              <SelectItem value="completed">Genomförda</SelectItem>
              <SelectItem value="no_show">Ej infunna</SelectItem>
              <SelectItem value="cancelled">Avbokade</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
            className="sm:w-[160px]"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
            className="sm:w-[160px]"
          />
        </div>

        {/* Tabell */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {data ? `${data.total} bokningar` : "Laddar..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Laddar...</p>
            ) : data?.bookings.length === 0 ? (
              <p className="text-gray-500">Inga bokningar hittades</p>
            ) : (
              <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {data?.bookings.map((booking) => (
                  <Card key={booking.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{booking.customerName}</span>
                        <Badge className={STATUS_COLORS[booking.status] || ""}>
                          {STATUS_LABELS[booking.status] || booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{booking.providerBusinessName}</p>
                      <p className="text-sm text-gray-500">{booking.serviceName}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{new Date(booking.bookingDate).toLocaleDateString("sv-SE")}</span>
                        <span>{booking.startTime}–{booking.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {booking.isManualBooking && (
                          <Badge variant="outline" className="text-xs">Manuell</Badge>
                        )}
                      </div>
                      {canCancel(booking) && (
                        <Button
                          variant="outline"
                          className="w-full text-red-600 hover:text-red-700"
                          onClick={() => setCancelBooking(booking)}
                        >
                          Avboka
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Datum</th>
                      <th className="pb-2 font-medium text-gray-500">Tid</th>
                      <th className="pb-2 font-medium text-gray-500">Kund</th>
                      <th className="pb-2 font-medium text-gray-500">Leverantör</th>
                      <th className="pb-2 font-medium text-gray-500">Tjänst</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
                      <th className="pb-2 font-medium text-gray-500 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.bookings.map((booking) => (
                      <tr key={booking.id} className="border-b last:border-0">
                        <td className="py-3">
                          {new Date(booking.bookingDate).toLocaleDateString("sv-SE")}
                        </td>
                        <td className="py-3 text-gray-600">
                          {booking.startTime}–{booking.endTime}
                        </td>
                        <td className="py-3">{booking.customerName}</td>
                        <td className="py-3">{booking.providerBusinessName}</td>
                        <td className="py-3 text-gray-600">{booking.serviceName}</td>
                        <td className="py-3">
                          <Badge className={STATUS_COLORS[booking.status] || ""}>
                            {STATUS_LABELS[booking.status] || booking.status}
                          </Badge>
                          {booking.isManualBooking && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Manuell
                            </Badge>
                          )}
                        </td>
                        <td className="py-3">
                          {canCancel(booking) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setCancelBooking(booking)}
                            >
                              Avboka
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Sida {data.page} av {data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Avbokningsdialog */}
      {cancelBooking && (
        <ResponsiveAlertDialog open={true} onOpenChange={() => { setCancelBooking(null); setCancelReason("") }}>
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Avboka bokning</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                Avboka bokning för {cancelBooking.customerName} hos{" "}
                {cancelBooking.providerBusinessName} den{" "}
                {new Date(cancelBooking.bookingDate).toLocaleDateString("sv-SE")}?
                Både kund och leverantör kommer att notifieras.
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <Textarea
              placeholder="Ange anledning till avbokning..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel>Avbryt</ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={handleCancel}
                disabled={cancelLoading || !cancelReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {cancelLoading ? "Avbokar..." : "Avboka"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}
    </AdminLayout>
  )
}
