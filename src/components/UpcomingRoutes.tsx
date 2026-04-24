"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { clientLogger } from "@/lib/client-logger"

interface UpcomingRoute {
  id: string
  dateFrom: string
  dateTo: string
  municipality: string
  serviceType: string | null
}

interface UpcomingRoutesProps {
  providerId: string
}

function formatRouteDateRange(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)

  const sameDay = from.toDateString() === to.toDateString()
  if (sameDay) {
    return format(from, "d MMM", { locale: sv })
  }

  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  if (sameMonth) {
    return `${format(from, "d", { locale: sv })}–${format(to, "d MMM", { locale: sv })}`
  }

  return `${format(from, "d MMM", { locale: sv })}–${format(to, "d MMM", { locale: sv })}`
}

export function UpcomingRoutes({ providerId }: UpcomingRoutesProps) {
  const [routes, setRoutes] = useState<UpcomingRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await fetch(`/api/providers/${providerId}/upcoming-routes`)
        if (response.ok) {
          const data = await response.json()
          setRoutes(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        clientLogger.error("Error fetching upcoming routes:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoutes()
  }, [providerId])

  if (isLoading) {
    return null
  }

  if (routes.length === 0) {
    return null
  }

  return (
    <Card className="mb-8 border-green-200 bg-green-50" data-testid="upcoming-routes">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-green-800">Kommande planerade besök</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {routes.map((route) => (
            <li
              key={route.id}
              className="flex items-start gap-2 text-sm text-green-900"
            >
              <span aria-hidden="true">📅</span>
              <span>
                <span className="font-medium">
                  {formatRouteDateRange(route.dateFrom, route.dateTo)}
                </span>
                {" · "}
                {route.municipality}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-green-700 mt-3">
          Planerar du en bokning i området? Kontakta leverantören eller boka en tid.
        </p>
      </CardContent>
    </Card>
  )
}
