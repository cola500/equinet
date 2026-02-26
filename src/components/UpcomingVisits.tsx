"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

interface Visit {
  id: string
  date: string
  location: string
}

interface UpcomingVisitsProps {
  providerId: string
}

export function UpcomingVisits({ providerId }: UpcomingVisitsProps) {
  const [visits, setVisits] = useState<Visit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        // Fetch exceptions from today onwards
        const today = format(new Date(), "yyyy-MM-dd")
        const response = await fetch(
          `/api/providers/${providerId}/availability-exceptions?from=${today}`
        )

        if (response.ok) {
          const data = await response.json()
          // Filter to only show visits with location (not just closed days)
          const visitsWithLocation = data.filter(
            (e: { location?: string | null; isClosed: boolean }) => e.location && !e.isClosed
          )
          setVisits(visitsWithLocation)
        }
      } catch (error) {
        console.error("Error fetching visits:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVisits()
  }, [providerId])

  if (isLoading) {
    return null // Don't show loading state, just hide until loaded
  }

  if (visits.length === 0) {
    return null // Don't show section if no visits planned
  }

  return (
    <Card className="mb-8 border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-green-800">
          Kommande besök i olika områden
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {visits.map((visit) => (
            <span
              key={visit.id}
              className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
            >
              {visit.location} - {format(new Date(visit.date + "T00:00:00"), "d MMM", { locale: sv })}
            </span>
          ))}
        </div>
        <p className="text-xs text-green-700 mt-3">
          Bor du i något av dessa områden? Passa på att boka!
        </p>
      </CardContent>
    </Card>
  )
}
