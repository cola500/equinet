"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface BugReportDetail {
  id: string
  title: string
  description: string
  reproductionSteps: string | null
  pageUrl: string
  userAgent: string | null
  platform: string | null
  userRole: string
  status: string
  priority: string
  internalNote: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  user: { firstName: string; lastName: string; email: string } | null
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Kunde inte hämta buggrapport")
    return r.json()
  })

const STATUS_LABELS: Record<string, string> = {
  NEW: "Ny",
  INVESTIGATING: "Under utredning",
  PLANNED: "Planerad",
  FIXED: "Fixad",
  DISMISSED: "Avfärdad",
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  INVESTIGATING: "bg-amber-100 text-amber-800",
  PLANNED: "bg-purple-100 text-purple-800",
  FIXED: "bg-green-100 text-green-800",
  DISMISSED: "bg-gray-100 text-gray-800",
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-100 text-red-800",
  P1: "bg-orange-100 text-orange-800",
  P2: "bg-yellow-100 text-yellow-800",
  P3: "bg-gray-100 text-gray-600",
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Kund",
  PROVIDER: "Leverantör",
  ADMIN: "Admin",
  UNKNOWN: "Okänd",
}

export default function AdminBugReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: bug, mutate } = useSWR<BugReportDetail>(
    `/api/admin/bug-reports/${id}`,
    fetcher
  )

  const [status, setStatus] = useState<string | null>(null)
  const [priority, setPriority] = useState<string | null>(null)
  const [internalNote, setInternalNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Use local state if edited, otherwise data from API
  const currentStatus = status ?? bug?.status ?? ""
  const currentPriority = priority ?? bug?.priority ?? ""
  const currentNote = internalNote ?? bug?.internalNote ?? ""

  const hasChanges =
    (status !== null && status !== bug?.status) ||
    (priority !== null && priority !== bug?.priority) ||
    (internalNote !== null && internalNote !== (bug?.internalNote ?? ""))

  async function handleSave() {
    setSaving(true)
    try {
      const updates: Record<string, string> = {}
      if (status !== null && status !== bug?.status) updates.status = status
      if (priority !== null && priority !== bug?.priority)
        updates.priority = priority
      if (internalNote !== null && internalNote !== (bug?.internalNote ?? ""))
        updates.internalNote = internalNote

      const res = await fetch(`/api/admin/bug-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kunde inte uppdatera")
      }

      toast.success("Buggrapport uppdaterad")
      setStatus(null)
      setPriority(null)
      setInternalNote(null)
      mutate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte uppdatera"
      )
    } finally {
      setSaving(false)
    }
  }

  if (!bug) {
    return (
      <AdminLayout>
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-green-600" />
          <p className="mt-2 text-gray-600">Laddar buggrapport...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <Link
        href="/admin/bug-reports"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Tillbaka till listan
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <h1 className="text-2xl font-bold">{bug.title}</h1>
        <Badge variant="outline" className={STATUS_COLORS[bug.status]}>
          {STATUS_LABELS[bug.status] || bug.status}
        </Badge>
        <Badge variant="outline" className={PRIORITY_COLORS[bug.priority]}>
          {bug.priority}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Beskrivning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{bug.description}</p>
            </CardContent>
          </Card>

          {bug.reproductionSteps && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Steg för att återskapa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {bug.reproductionSteps}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teknisk information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Sida</span>
                <span className="font-mono text-xs">{bug.pageUrl}</span>
              </div>
              {bug.userAgent && (
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-gray-500">User Agent</span>
                  <span className="truncate font-mono text-xs">
                    {bug.userAgent}
                  </span>
                </div>
              )}
              {bug.platform && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Plattform</span>
                  <span>{bug.platform}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Roll</span>
                <span>{ROLE_LABELS[bug.userRole] || bug.userRole}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: triage controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Triage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={currentStatus} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Ny</SelectItem>
                    <SelectItem value="INVESTIGATING">
                      Under utredning
                    </SelectItem>
                    <SelectItem value="PLANNED">Planerad</SelectItem>
                    <SelectItem value="FIXED">Fixad</SelectItem>
                    <SelectItem value="DISMISSED">Avfärdad</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Prioritet</Label>
                <Select value={currentPriority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - Kritisk</SelectItem>
                    <SelectItem value="P1">P1 - Hög</SelectItem>
                    <SelectItem value="P2">P2 - Medium</SelectItem>
                    <SelectItem value="P3">P3 - Låg</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="internal-note">Intern kommentar</Label>
                <textarea
                  id="internal-note"
                  value={currentNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Intern kommentar (visas inte för användaren)"
                  rows={4}
                  maxLength={5000}
                  className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="w-full"
              >
                {saving ? "Sparar..." : "Spara ändringar"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapportör</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {bug.user ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Namn</span>
                    <span>
                      {bug.user.firstName} {bug.user.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">E-post</span>
                    <span>{bug.user.email}</span>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Anonym rapportör</p>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Skapad</span>
                <span>
                  {new Date(bug.createdAt).toLocaleString("sv-SE")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Uppdaterad</span>
                <span>
                  {new Date(bug.updatedAt).toLocaleString("sv-SE")}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/admin/bug-reports")}
          >
            Tillbaka till listan
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}
