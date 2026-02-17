"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CalendarDays, Store, CreditCard } from "lucide-react"
import { InfoPopover } from "@/components/ui/info-popover"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface AdminStats {
  users: {
    total: number
    customers: number
    providers: number
    newThisMonth: number
  }
  bookings: {
    total: number
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    completedThisMonth: number
  }
  providers: {
    total: number
    active: number
    verified: number
    pendingVerifications: number
  }
  revenue: {
    totalCompleted: number
    thisMonth: number
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed")
        return res.json()
      })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Adminpanel</h1>

        {loading ? (
          <p className="text-gray-500">Laddar statistik...</p>
        ) : stats ? (
          <>
            {/* KPI-kort */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-1">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Användare
                    </CardTitle>
                    <InfoPopover text="Totalt antal registrerade användare (kunder och leverantörer). Nya denna månad baserat på registreringsdatum." />
                  </div>
                  <Users className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.users.total}</div>
                  <p className="text-xs text-gray-500">
                    +{stats.users.newThisMonth} denna månad
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-1">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Bokningar
                    </CardTitle>
                    <InfoPopover text="Totalt antal bokningar i systemet. Genomförda denna månad inkluderar bokningar med status 'genomförd'." />
                  </div>
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.bookings.total}</div>
                  <p className="text-xs text-gray-500">
                    {stats.bookings.completedThisMonth} genomförda denna månad
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-1">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Leverantörer
                    </CardTitle>
                    <InfoPopover text="Verifierade har godkänd legitimation. Väntande-badge visar antal som väntar på granskning." />
                  </div>
                  <Store className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.providers.total}</div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {stats.providers.verified} verifierade
                    </p>
                    {stats.providers.pendingVerifications > 0 && (
                      <Link href="/admin/verifications">
                        <Badge variant="secondary" className="text-xs">
                          {stats.providers.pendingVerifications} väntande
                        </Badge>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-1">
                    <CardTitle className="text-sm font-medium text-gray-500">
                      Intäkter
                    </CardTitle>
                    <InfoPopover text="Baserat på genomförda bokningars pris. Belopp i SEK inklusive moms." />
                  </div>
                  <CreditCard className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(stats.revenue.totalCompleted / 100).toLocaleString("sv-SE")} kr
                  </div>
                  <p className="text-xs text-gray-500">
                    {(stats.revenue.thisMonth / 100).toLocaleString("sv-SE")} kr denna månad
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detaljerad statistik */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-lg">Bokningsstatus</CardTitle>
                    <InfoPopover text="Väntande = inväntar bekräftelse. Bekräftade = leverantören har accepterat. Genomförda = besöket har ägt rum. Avbokade = avbokade av kund, leverantör eller admin." />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Väntande</span>
                      <span className="font-medium">{stats.bookings.pending}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Bekräftade</span>
                      <span className="font-medium">{stats.bookings.confirmed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Genomförda</span>
                      <span className="font-medium">{stats.bookings.completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Avbokade</span>
                      <span className="font-medium">{stats.bookings.cancelled}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-lg">Användarfördelning</CardTitle>
                    <InfoPopover text="Aktiva leverantörer har minst en publicerad tjänst och är inte inaktiverade." />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Kunder</span>
                      <span className="font-medium">{stats.users.customers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Leverantörer</span>
                      <span className="font-medium">{stats.users.providers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Aktiva leverantörer</span>
                      <span className="font-medium">{stats.providers.active}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-red-500">Kunde inte ladda statistik</p>
        )}
      </div>
    </AdminLayout>
  )
}
