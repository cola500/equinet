"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronLeft, ChevronRight, Star, Trash2 } from "lucide-react"

interface AdminReview {
  id: string
  type: "review" | "customerReview"
  rating: number
  comment: string | null
  reply: string | null
  customerName: string
  providerBusinessName: string
  bookingDate: string | null
  createdAt: string
}

interface ReviewsResponse {
  reviews: AdminReview[]
  total: number
  page: number
  totalPages: number
}

export default function AdminReviewsPage() {
  const [data, setData] = useState<ReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [deleteReview, setDeleteReview] = useState<AdminReview | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (type !== "all") params.set("type", type)
    if (search) params.set("search", search)
    params.set("page", String(page))
    params.set("limit", "20")

    try {
      const res = await fetch(`/api/admin/reviews?${params}`)
      if (!res.ok) throw new Error("Fetch failed")
      const json = await res.json()
      setData(json)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [type, search, page])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleDelete = async () => {
    if (!deleteReview) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/admin/reviews/${deleteReview.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: deleteReview.type }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Något gick fel")
        return
      }
      await fetchReviews()
    } catch {
      alert("Något gick fel")
    } finally {
      setDeleteLoading(false)
      setDeleteReview(null)
    }
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Recensioner</h1>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue placeholder="Alla typer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla typer</SelectItem>
              <SelectItem value="review">Kundrecensioner</SelectItem>
              <SelectItem value="customerReview">Leverantörsrecensioner</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Sök i kommentarer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="sm:max-w-xs"
          />
        </div>

        {/* Tabell */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {data ? `${data.total} recensioner` : "Laddar..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Laddar...</p>
            ) : data?.reviews.length === 0 ? (
              <p className="text-gray-500">Inga recensioner hittades</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Typ</th>
                      <th className="pb-2 font-medium text-gray-500">Betyg</th>
                      <th className="pb-2 font-medium text-gray-500">Kommentar</th>
                      <th className="pb-2 font-medium text-gray-500">Kund</th>
                      <th className="pb-2 font-medium text-gray-500">Leverantör</th>
                      <th className="pb-2 font-medium text-gray-500">Datum</th>
                      <th className="pb-2 font-medium text-gray-500 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.reviews.map((review) => (
                      <tr key={`${review.type}-${review.id}`} className="border-b last:border-0">
                        <td className="py-3">
                          <Badge variant="outline">
                            {review.type === "review" ? "Kund" : "Leverantör"}
                          </Badge>
                        </td>
                        <td className="py-3">{renderStars(review.rating)}</td>
                        <td className="py-3 max-w-[300px]">
                          <div className="truncate text-gray-700">{review.comment || "-"}</div>
                          {review.reply && (
                            <div className="truncate text-xs text-gray-500 mt-1">
                              Svar: {review.reply}
                            </div>
                          )}
                        </td>
                        <td className="py-3">{review.customerName}</td>
                        <td className="py-3">{review.providerBusinessName}</td>
                        <td className="py-3 text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString("sv-SE")}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteReview(review)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Bekräftelsedialog */}
      {deleteReview && (
        <AlertDialog open={true} onOpenChange={() => setDeleteReview(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort recension</AlertDialogTitle>
              <AlertDialogDescription>
                Är du säker på att du vill ta bort denna recension av{" "}
                <strong>{deleteReview.customerName}</strong>? Denna åtgärd kan inte ångras.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? "Tar bort..." : "Ta bort"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AdminLayout>
  )
}
