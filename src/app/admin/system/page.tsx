"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Database, Clock } from "lucide-react"

interface SystemData {
  database: {
    healthy: boolean
    responseTimeMs: number
  }
  cron: {
    lastReminderRun: string | null
    remindersCount: number
  }
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/system")
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed")
        return res.json()
      })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Systemstatus</h1>

        {loading ? (
          <p className="text-gray-500">Laddar...</p>
        ) : data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Databas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Databas</CardTitle>
                <Database className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    {data.database.healthy ? (
                      <Badge className="bg-green-100 text-green-700">Frisk</Badge>
                    ) : (
                      <Badge variant="destructive">Nere</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Svarstid</span>
                    <span className="font-medium">{data.database.responseTimeMs} ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cron / Påminnelser */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Påminnelser</CardTitle>
                <Clock className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Senaste körning</span>
                    <span className="font-medium">
                      {data.cron.lastReminderRun
                        ? new Date(data.cron.lastReminderRun).toLocaleString("sv-SE")
                        : "Aldrig"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Totalt skickade</span>
                    <span className="font-medium">{data.cron.remindersCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Applikation */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Applikation</CardTitle>
                <Activity className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Miljö</span>
                    <Badge variant="outline">
                      {process.env.NODE_ENV}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-red-500">Kunde inte ladda systemstatus</p>
        )}
      </div>
    </AdminLayout>
  )
}
