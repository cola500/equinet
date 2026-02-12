"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Activity, Database, Clock, Mail } from "lucide-react"
import { toast } from "sonner"

interface SystemData {
  database: {
    healthy: boolean
    responseTimeMs: number
  }
  cron: {
    lastReminderRun: string | null
    remindersCount: number
  }
  email: {
    disabledByEnv: boolean
  }
}

interface SettingsData {
  settings: Record<string, string>
  env: {
    emailDisabledByEnv: boolean
  }
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailToggleLoading, setEmailToggleLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/system").then((res) => {
        if (!res.ok) throw new Error("Fetch failed")
        return res.json()
      }),
      fetch("/api/admin/settings").then((res) => {
        if (!res.ok) throw new Error("Fetch failed")
        return res.json()
      }),
    ])
      .then(([systemData, settingsData]) => {
        setData(systemData)
        setSettings(settingsData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const emailDisabledByEnv = data?.email?.disabledByEnv ?? false
  const emailDisabledByRuntime =
    settings?.settings?.disable_emails === "true"
  const emailPaused = emailDisabledByEnv || emailDisabledByRuntime

  async function handleEmailToggle(paused: boolean) {
    setEmailToggleLoading(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "disable_emails",
          value: paused ? "true" : "false",
        }),
      })
      if (!res.ok) throw new Error("Failed")
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              settings: {
                ...prev.settings,
                disable_emails: paused ? "true" : "false",
              },
            }
          : prev
      )
      toast.success(paused ? "E-post pausat" : "E-post aktiverat")
    } catch {
      toast.error("Kunde inte ändra inställningen")
    } finally {
      setEmailToggleLoading(false)
    }
  }

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

            {/* Utveckling & Test */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Utveckling & Test</CardTitle>
                <Mail className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label
                        htmlFor="email-toggle"
                        className="text-sm font-medium"
                      >
                        Pausa e-postutskick
                      </label>
                      <p className="text-xs text-gray-500">
                        {emailDisabledByEnv
                          ? "Avstängt via miljövariabel (DISABLE_EMAILS)"
                          : "Loggar till konsolen istället. Nollställs vid omstart av servern."}
                      </p>
                    </div>
                    <Switch
                      id="email-toggle"
                      checked={emailPaused}
                      disabled={emailDisabledByEnv || emailToggleLoading}
                      onCheckedChange={handleEmailToggle}
                    />
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
