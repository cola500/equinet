"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

export default function AdminBookingsPage() {
  const [data, setData] = useState<BookingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)

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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Datum</th>
                      <th className="pb-2 font-medium text-gray-500">Tid</th>
                      <th className="pb-2 font-medium text-gray-500">Kund</th>
                      <th className="pb-2 font-medium text-gray-500">Leverantör</th>
                      <th className="pb-2 font-medium text-gray-500">Tjänst</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Sida {data.page} av {data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
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
    </AdminLayout>
  )
}
