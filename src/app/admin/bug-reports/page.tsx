"use client"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

interface BugReportListItem {
  id: string
  title: string
  status: string
  priority: string
  userRole: string
  pageUrl: string
  createdAt: string
  user: { firstName: string; lastName: string } | null
}

interface BugReportsResponse {
  bugReports: BugReportListItem[]
  total: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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

export default function AdminBugReportsPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sortBy, setSortBy] = useState("createdAt")

  const params = new URLSearchParams()
  if (statusFilter !== "ALL") params.set("status", statusFilter)
  params.set("sortBy", sortBy)
  params.set("sortOrder", "desc")

  const { data, isLoading } = useSWR<BugReportsResponse>(
    `/api/admin/bug-reports?${params.toString()}`,
    fetcher
  )

  return (
    <AdminLayout>
      <h1 className="mb-2 text-3xl font-bold">Buggrapporter</h1>
      <p className="mb-6 text-gray-600">
        Hantera och triagera inkomna buggrapporter.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrera status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alla statusar</SelectItem>
            <SelectItem value="NEW">Ny</SelectItem>
            <SelectItem value="INVESTIGATING">Under utredning</SelectItem>
            <SelectItem value="PLANNED">Planerad</SelectItem>
            <SelectItem value="FIXED">Fixad</SelectItem>
            <SelectItem value="DISMISSED">Avfärdad</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sortera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Datum</SelectItem>
            <SelectItem value="priority">Prioritet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-green-600" />
          <p className="mt-2 text-gray-600">Laddar buggrapporter...</p>
        </div>
      ) : !data?.bugReports?.length ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <p className="text-gray-600">Inga buggrapporter att visa.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium">Titel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Prioritet</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Roll
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Rapportör
                </th>
                <th className="px-4 py-3 font-medium">Skapad</th>
              </tr>
            </thead>
            <tbody>
              {data.bugReports.map((bug) => (
                <tr
                  key={bug.id}
                  onClick={() => router.push(`/admin/bug-reports/${bug.id}`)}
                  className="cursor-pointer border-b transition-colors hover:bg-gray-50"
                >
                  <td className="max-w-[300px] truncate px-4 py-3 font-medium">
                    {bug.title}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[bug.status]}
                    >
                      {STATUS_LABELS[bug.status] || bug.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={PRIORITY_COLORS[bug.priority]}
                    >
                      {bug.priority}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {ROLE_LABELS[bug.userRole] || bug.userRole}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {bug.user
                      ? `${bug.user.firstName} ${bug.user.lastName}`
                      : "Anonym"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(bug.createdAt).toLocaleDateString("sv-SE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
            {data.total} rapport{data.total !== 1 ? "er" : ""} totalt
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
