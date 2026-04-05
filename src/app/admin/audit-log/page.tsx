"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield } from "lucide-react"
import { clientLogger } from "@/lib/client-logger"

interface AuditEntry {
  id: string
  userId: string
  userEmail: string
  action: string
  ipAddress: string | null
  statusCode: number
  createdAt: string
}

interface AuditResponse {
  entries: AuditEntry[]
  total: number
  nextCursor: string | null
}

function statusBadge(code: number) {
  if (code >= 200 && code < 300) return <Badge variant="default">{code}</Badge>
  if (code >= 400 && code < 500) return <Badge variant="secondary">{code}</Badge>
  return <Badge variant="destructive">{code}</Badge>
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEntries = useCallback(async (cursor?: string) => {
    setIsLoading(true)
    try {
      const url = cursor
        ? `/api/admin/audit-log?cursor=${cursor}&limit=100`
        : "/api/admin/audit-log?limit=100"
      const res = await fetch(url)
      if (!res.ok) return
      const data: AuditResponse = await res.json()

      if (cursor) {
        setEntries((prev) => [...prev, ...data.entries])
      } else {
        setEntries(data.entries)
      }
      setTotal(data.total)
      setNextCursor(data.nextCursor)
    } catch (err) {
      clientLogger.error("Failed to fetch audit log", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  return (
    <AdminLayout>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Audit Log</CardTitle>
          </div>
          <p className="text-sm text-gray-600">
            {total} admin-operationer loggade
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && entries.length === 0 ? (
            <p className="text-sm text-gray-500">Laddar...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500">Inga loggposter att visa.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-600">
                      <th className="pb-2 pr-4">Tid</th>
                      <th className="pb-2 pr-4">Användare</th>
                      <th className="pb-2 pr-4">Åtgärd</th>
                      <th className="pb-2 pr-4">IP</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap text-gray-500">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="py-2 pr-4">{entry.userEmail}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {entry.action}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">
                          {entry.ipAddress ?? "-"}
                        </td>
                        <td className="py-2">{statusBadge(entry.statusCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nextCursor && (
                <div className="mt-4 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fetchEntries(nextCursor)}
                    disabled={isLoading}
                  >
                    {isLoading ? "Laddar..." : "Visa fler"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  )
}
