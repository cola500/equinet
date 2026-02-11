"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Star } from "lucide-react"

interface AdminProvider {
  id: string
  businessName: string
  city: string | null
  isVerified: boolean
  isActive: boolean
  createdAt: string
  bookingCount: number
  serviceCount: number
  averageRating: number | null
  hasFortnox: boolean
}

interface ProvidersResponse {
  providers: AdminProvider[]
  total: number
  page: number
  totalPages: number
}

export default function AdminProvidersPage() {
  const [data, setData] = useState<ProvidersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState("all")
  const [active, setActive] = useState("all")
  const [page, setPage] = useState(1)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (verified !== "all") params.set("verified", verified)
    if (active !== "all") params.set("active", active)
    params.set("page", String(page))
    params.set("limit", "20")

    try {
      const res = await fetch(`/api/admin/providers?${params}`)
      if (!res.ok) throw new Error("Fetch failed")
      const json = await res.json()
      setData(json)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [verified, active, page])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Leverantörer</h1>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={verified} onValueChange={(v) => { setVerified(v); setPage(1) }}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Verifiering" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="true">Verifierade</SelectItem>
              <SelectItem value="false">Ej verifierade</SelectItem>
            </SelectContent>
          </Select>
          <Select value={active} onValueChange={(v) => { setActive(v); setPage(1) }}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="true">Aktiva</SelectItem>
              <SelectItem value="false">Inaktiva</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {data ? `${data.total} leverantörer` : "Laddar..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Laddar...</p>
            ) : data?.providers.length === 0 ? (
              <p className="text-gray-500">Inga leverantörer hittades</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Företag</th>
                      <th className="pb-2 font-medium text-gray-500">Ort</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
                      <th className="pb-2 font-medium text-gray-500">Betyg</th>
                      <th className="pb-2 font-medium text-gray-500">Bokningar</th>
                      <th className="pb-2 font-medium text-gray-500">Tjänster</th>
                      <th className="pb-2 font-medium text-gray-500">Registrerad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.providers.map((provider) => (
                      <tr key={provider.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">
                          {provider.businessName}
                          {provider.hasFortnox && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Fortnox
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 text-gray-600">
                          {provider.city || "-"}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {provider.isVerified ? (
                              <Badge className="bg-green-100 text-green-700">
                                Verifierad
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Ej verifierad</Badge>
                            )}
                            {!provider.isActive && (
                              <Badge variant="destructive">Inaktiv</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          {provider.averageRating !== null ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>{provider.averageRating.toFixed(1)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 text-center">{provider.bookingCount}</td>
                        <td className="py-3 text-center">{provider.serviceCount}</td>
                        <td className="py-3 text-gray-500">
                          {new Date(provider.createdAt).toLocaleDateString("sv-SE")}
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
