"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface FortnoxConnection {
  providerId: string
  businessName: string
  connectedAt: string
  tokenExpiresAt: string
}

interface IntegrationsData {
  fortnox: {
    connections: FortnoxConnection[]
    totalConnected: number
  }
  payments: {
    total: number
    succeeded: number
    pending: number
    failed: number
    totalRevenue: number
  }
}

export default function AdminIntegrationsPage() {
  const [data, setData] = useState<IntegrationsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/integrations")
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
        <h1 className="text-2xl font-bold">Integrationer</h1>

        {loading ? (
          <p className="text-gray-500">Laddar...</p>
        ) : data ? (
          <>
            {/* Fortnox */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Fortnox
                  <Badge variant="outline" className="ml-2">
                    {data.fortnox.totalConnected} anslutna
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.fortnox.connections.length === 0 ? (
                  <p className="text-gray-500">Inga Fortnox-kopplingar</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-gray-500">Leverantör</th>
                          <th className="pb-2 font-medium text-gray-500">Ansluten</th>
                          <th className="pb-2 font-medium text-gray-500">Token utgår</th>
                          <th className="pb-2 font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.fortnox.connections.map((fc) => {
                          const expired = new Date(fc.tokenExpiresAt) < new Date()
                          return (
                            <tr key={fc.providerId} className="border-b last:border-0">
                              <td className="py-3 font-medium">{fc.businessName}</td>
                              <td className="py-3 text-gray-600">
                                {new Date(fc.connectedAt).toLocaleDateString("sv-SE")}
                              </td>
                              <td className="py-3 text-gray-600">
                                {new Date(fc.tokenExpiresAt).toLocaleDateString("sv-SE")}
                              </td>
                              <td className="py-3">
                                {expired ? (
                                  <Badge variant="destructive">Utgången</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700">Aktiv</Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Betalningar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Betalningar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Totalt</p>
                    <p className="text-xl font-bold">{data.payments.total}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Lyckade</p>
                    <p className="text-xl font-bold text-green-600">
                      {data.payments.succeeded}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Väntande</p>
                    <p className="text-xl font-bold text-yellow-600">
                      {data.payments.pending}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Misslyckade</p>
                    <p className="text-xl font-bold text-red-600">
                      {data.payments.failed}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">Total intäkt</p>
                  <p className="text-2xl font-bold">
                    {(data.payments.totalRevenue / 100).toLocaleString("sv-SE")} kr
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-red-500">Kunde inte ladda integrationsdata</p>
        )}
      </div>
    </AdminLayout>
  )
}
