"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  userType: string
  isAdmin: boolean
  createdAt: string
  emailVerified: string | null
  provider: {
    businessName: string
    isVerified: boolean
    isActive: boolean
  } | null
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  totalPages: number
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [type, setType] = useState("all")
  const [page, setPage] = useState(1)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (type !== "all") params.set("type", type)
    params.set("page", String(page))
    params.set("limit", "20")

    try {
      const res = await fetch(`/api/admin/users?${params}`)
      const json = await res.json()
      setData(json)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [search, type, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleTypeChange = (value: string) => {
    setType(value)
    setPage(1)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Användare</h1>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Sök på namn eller e-post..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Alla typer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla typer</SelectItem>
              <SelectItem value="customer">Kunder</SelectItem>
              <SelectItem value="provider">Leverantörer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabell */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {data ? `${data.total} användare` : "Laddar..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Laddar...</p>
            ) : data?.users.length === 0 ? (
              <p className="text-gray-500">Inga användare hittades</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Namn</th>
                      <th className="pb-2 font-medium text-gray-500">E-post</th>
                      <th className="pb-2 font-medium text-gray-500">Typ</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
                      <th className="pb-2 font-medium text-gray-500">Registrerad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.users.map((user) => (
                      <tr key={user.id} className="border-b last:border-0">
                        <td className="py-3">
                          {user.firstName || user.lastName
                            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                            : "-"}
                          {user.isAdmin && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Admin
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 text-gray-600">{user.email}</td>
                        <td className="py-3">
                          {user.userType === "provider" ? (
                            <Badge variant="outline">
                              {user.provider?.businessName || "Leverantör"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Kund</Badge>
                          )}
                        </td>
                        <td className="py-3">
                          {user.emailVerified ? (
                            <Badge className="bg-green-100 text-green-700">
                              Verifierad
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Ej verifierad</Badge>
                          )}
                          {user.provider && !user.provider.isActive && (
                            <Badge variant="destructive" className="ml-1">
                              Inaktiv
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString("sv-SE")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
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
