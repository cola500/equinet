"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { InsightsCharts } from "@/components/provider/InsightsCharts"
import { ErrorState } from "@/components/ui/error-state"
import { useRetry } from "@/hooks/useRetry"
import { toast } from "sonner"

type Period = 3 | 6 | 12

interface InsightsData {
  serviceBreakdown: Array<{ serviceName: string; count: number; revenue: number }>
  timeHeatmap: Array<{ day: string; dayIndex: number; hour: number; count: number }>
  customerRetention: Array<{ month: string; newCustomers: number; returningCustomers: number }>
  kpis: {
    cancellationRate: number
    noShowRate: number
    averageBookingValue: number
    uniqueCustomers: number
    manualBookingRate: number
  }
}

const EMPTY_DATA: InsightsData = {
  serviceBreakdown: [],
  timeHeatmap: [],
  customerRetention: [],
  kpis: { cancellationRate: 0, noShowRate: 0, averageBookingValue: 0, uniqueCustomers: 0, manualBookingRate: 0 },
}

export default function ProviderInsightsPage() {
  const { isLoading: authLoading, isProvider } = useAuth()
  const [data, setData] = useState<InsightsData>(EMPTY_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>(6)

  const { retry, retryCount, isRetrying, canRetry } = useRetry({
    maxRetries: 3,
    onMaxRetriesReached: () => {
      toast.error("Kunde inte hämta insikter efter flera försök.")
    },
  })

  useEffect(() => {
    if (isProvider) {
      fetchInsights()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider, period])

  const fetchInsights = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/provider/insights?months=${period}`)
      if (!response.ok) {
        throw new Error("Kunde inte hämta insikter")
      }
      const json = await response.json()
      setData(json)
    } catch {
      setError("Kunde inte hämta insikter. Kontrollera din internetanslutning.")
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || !isProvider) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Affärsinsikter</h1>
          <p className="text-gray-600 mt-1">
            Analysera dina bokningar, tjänster och kunder
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {([3, 6, 12] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {p} mån
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Kunde inte hämta insikter"
          description={error}
          onRetry={() => retry(fetchInsights)}
          isRetrying={isRetrying}
          retryCount={retryCount}
          canRetry={canRetry}
        />
      ) : (
        <InsightsCharts
          serviceBreakdown={data.serviceBreakdown}
          timeHeatmap={data.timeHeatmap}
          customerRetention={data.customerRetention}
          kpis={data.kpis}
          isLoading={isLoading}
        />
      )}
    </ProviderLayout>
  )
}
