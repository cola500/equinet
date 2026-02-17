"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { ChevronLeft, ChevronRight, Star, MoreHorizontal } from "lucide-react"

interface AdminUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  userType: string
  isAdmin: boolean
  isBlocked: boolean
  createdAt: string
  emailVerified: string | null
  provider: {
    businessName: string
    isVerified: boolean
    isActive: boolean
    city?: string | null
    bookingCount?: number
    serviceCount?: number
    averageRating?: number | null
    hasFortnox?: boolean
  } | null
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  totalPages: number
}

interface PendingAction {
  userId: string
  userName: string
  action: "toggleBlocked" | "toggleAdmin"
  currentValue: boolean
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="p-6 text-gray-500">Laddar...</div></AdminLayout>}>
      <AdminUsersContent />
    </Suspense>
  )
}

function AdminUsersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [type, setType] = useState(searchParams.get("type") || "all")
  const [verified, setVerified] = useState("all")
  const [active, setActive] = useState("all")
  const [page, setPage] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const isProviderView = type === "provider"

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (type !== "all") params.set("type", type)
    if (isProviderView && verified !== "all") params.set("verified", verified)
    if (isProviderView && active !== "all") params.set("active", active)
    params.set("page", String(page))
    params.set("limit", "20")

    try {
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error("Fetch failed")
      const json = await res.json()
      setData(json)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [search, type, verified, active, page, isProviderView])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleTypeChange = (value: string) => {
    setType(value)
    setVerified("all")
    setActive("all")
    setPage(1)
    if (value !== "all") {
      router.replace(`/admin/users?type=${value}`, { scroll: false })
    } else {
      router.replace("/admin/users", { scroll: false })
    }
  }

  const handleAction = async () => {
    if (!pendingAction) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: pendingAction.userId,
          action: pendingAction.action,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || "Något gick fel")
        return
      }
      await fetchUsers()
    } catch {
      alert("Något gick fel")
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  const formatName = (user: AdminUser) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim()
    }
    return "-"
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Användare</h1>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder={isProviderView ? "Sök på namn, e-post eller företag..." : "Sök på namn eller e-post..."}
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
          {isProviderView && (
            <>
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
            </>
          )}
        </div>

        {/* Tabell */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {data ? `${data.total} ${isProviderView ? "leverantörer" : "användare"}` : "Laddar..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Laddar...</p>
            ) : data?.users.length === 0 ? (
              <p className="text-gray-500">Inga {isProviderView ? "leverantörer" : "användare"} hittades</p>
            ) : isProviderView ? (
              <ProviderTable users={data?.users || []} onAction={setPendingAction} formatName={formatName} />
            ) : (
              <GeneralTable users={data?.users || []} formatName={formatName} onAction={setPendingAction} />
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

      {/* Bekräftelsedialog */}
      {pendingAction && (
        <ResponsiveAlertDialog open={true} onOpenChange={() => setPendingAction(null)}>
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Bekräfta åtgärd</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                {pendingAction.action === "toggleBlocked" && !pendingAction.currentValue && (
                  <>Är du säker på att du vill blockera <strong>{pendingAction.userName}</strong>? Användaren kommer inte kunna logga in.</>
                )}
                {pendingAction.action === "toggleBlocked" && pendingAction.currentValue && (
                  <>Är du säker på att du vill avblockera <strong>{pendingAction.userName}</strong>?</>
                )}
                {pendingAction.action === "toggleAdmin" && !pendingAction.currentValue && (
                  <>Är du säker på att du vill göra <strong>{pendingAction.userName}</strong> till admin?</>
                )}
                {pendingAction.action === "toggleAdmin" && pendingAction.currentValue && (
                  <>Är du säker på att du vill ta bort admin-behörighet från <strong>{pendingAction.userName}</strong>?</>
                )}
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel>Avbryt</ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={handleAction}
                disabled={actionLoading}
                className={pendingAction.action === "toggleBlocked" && !pendingAction.currentValue ? "bg-red-600 hover:bg-red-700" : ""}
              >
                {actionLoading ? "Sparar..." : "Bekräfta"}
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}
    </AdminLayout>
  )
}

function UserActionsMenu({ user, formatName, onAction }: {
  user: AdminUser
  formatName: (u: AdminUser) => string
  onAction: (action: PendingAction) => void
}) {
  const name = formatName(user)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onAction({
            userId: user.id,
            userName: name,
            action: "toggleBlocked",
            currentValue: user.isBlocked,
          })}
        >
          {user.isBlocked ? "Avblockera" : "Blockera"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction({
            userId: user.id,
            userName: name,
            action: "toggleAdmin",
            currentValue: user.isAdmin,
          })}
        >
          {user.isAdmin ? "Ta bort admin" : "Gör admin"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GeneralTable({ users, formatName, onAction }: {
  users: AdminUser[]
  formatName: (u: AdminUser) => string
  onAction: (action: PendingAction) => void
}) {
  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{formatName(user)}</span>
                <UserActionsMenu user={user} formatName={formatName} onAction={onAction} />
              </div>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex gap-2 flex-wrap">
                {user.userType === "provider" ? (
                  <Badge variant="outline">Leverantör</Badge>
                ) : (
                  <Badge variant="outline">Kund</Badge>
                )}
                {user.emailVerified ? (
                  <Badge className="bg-green-100 text-green-700">Verifierad</Badge>
                ) : (
                  <Badge variant="secondary">Ej verifierad</Badge>
                )}
                {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                {user.isBlocked && <Badge variant="destructive">Blockerad</Badge>}
              </div>
              <p className="text-xs text-gray-400">
                Reg: {new Date(user.createdAt).toLocaleDateString("sv-SE")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-gray-500">Namn</th>
              <th className="pb-2 font-medium text-gray-500">E-post</th>
              <th className="pb-2 font-medium text-gray-500">Typ</th>
              <th className="pb-2 font-medium text-gray-500">E-post verifierad</th>
              <th className="pb-2 font-medium text-gray-500">Registrerad</th>
              <th className="pb-2 font-medium text-gray-500 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="py-3">
                  {formatName(user)}
                  {user.isAdmin && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Admin
                    </Badge>
                  )}
                  {user.isBlocked && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Blockerad
                    </Badge>
                  )}
                </td>
                <td className="py-3 text-gray-600">{user.email}</td>
                <td className="py-3">
                  {user.userType === "provider" ? (
                    <Badge variant="outline">Leverantör</Badge>
                  ) : (
                    <Badge variant="outline">Kund</Badge>
                  )}
                </td>
                <td className="py-3">
                  {user.emailVerified ? (
                    <Badge className="bg-green-100 text-green-700">Ja</Badge>
                  ) : (
                    <Badge variant="secondary">Nej</Badge>
                  )}
                </td>
                <td className="py-3 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString("sv-SE")}
                </td>
                <td className="py-3">
                  <UserActionsMenu user={user} formatName={formatName} onAction={onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProviderTable({ users, onAction, formatName }: {
  users: AdminUser[]
  onAction: (action: PendingAction) => void
  formatName: (u: AdminUser) => string
}) {
  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const name = user.firstName || user.lastName
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : null
          return (
            <Card key={user.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{user.provider?.businessName || "-"}</span>
                    {name && <p className="text-xs text-gray-500">{name}</p>}
                  </div>
                  <UserActionsMenu user={user} formatName={formatName} onAction={onAction} />
                </div>
                <p className="text-sm text-gray-500">{user.email}</p>
                {user.provider?.city && (
                  <p className="text-sm text-gray-600">{user.provider.city}</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  {user.provider?.isVerified ? (
                    <Badge className="bg-green-100 text-green-700">Verifierad</Badge>
                  ) : (
                    <Badge variant="secondary">Ej verifierad</Badge>
                  )}
                  {user.provider && !user.provider.isActive && (
                    <Badge variant="destructive">Inaktiv</Badge>
                  )}
                  {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                  {user.isBlocked && <Badge variant="destructive">Blockerad</Badge>}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{user.provider?.bookingCount ?? 0} bokn. / {user.provider?.serviceCount ?? 0} tj.</span>
                  {user.provider?.averageRating != null && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{user.provider.averageRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                {user.provider?.hasFortnox && (
                  <Badge variant="outline" className="text-xs">Fortnox</Badge>
                )}
                <p className="text-xs text-gray-400">
                  Reg: {new Date(user.createdAt).toLocaleDateString("sv-SE")}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-gray-500">Leverantör</th>
              <th className="pb-2 font-medium text-gray-500">Ort</th>
              <th className="pb-2 font-medium text-gray-500">Status</th>
              <th className="pb-2 font-medium text-gray-500">Betyg</th>
              <th className="pb-2 font-medium text-gray-500">Aktivitet</th>
              <th className="pb-2 font-medium text-gray-500">Registrerad</th>
              <th className="pb-2 font-medium text-gray-500 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const name = user.firstName || user.lastName
                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                : null
              return (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="font-medium">
                      {user.provider?.businessName || "-"}
                      {user.isAdmin && (
                        <Badge variant="secondary" className="ml-2 text-xs">Admin</Badge>
                      )}
                      {user.isBlocked && (
                        <Badge variant="destructive" className="ml-2 text-xs">Blockerad</Badge>
                      )}
                    </div>
                    {name && <div className="text-xs text-gray-500">{name}</div>}
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </td>
                  <td className="py-3 text-gray-600">
                    {user.provider?.city || "-"}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1 flex-wrap">
                      {user.provider?.isVerified ? (
                        <Badge className="bg-green-100 text-green-700">Verifierad</Badge>
                      ) : (
                        <Badge variant="secondary">Ej verifierad</Badge>
                      )}
                      {user.provider && !user.provider.isActive && (
                        <Badge variant="destructive">Inaktiv</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    {user.provider?.averageRating != null ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{user.provider.averageRating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="text-gray-600">
                      {user.provider?.bookingCount ?? 0} bokn. / {user.provider?.serviceCount ?? 0} tj.
                    </div>
                    {user.provider?.hasFortnox && (
                      <Badge variant="outline" className="text-xs mt-1">Fortnox</Badge>
                    )}
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="py-3">
                    <UserActionsMenu user={user} formatName={formatName} onAction={onAction} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
