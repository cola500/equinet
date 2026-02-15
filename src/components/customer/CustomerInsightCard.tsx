"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, AlertTriangle, RefreshCw } from "lucide-react"

interface CustomerInsight {
  frequency: string
  topServices: string[]
  patterns: string[]
  riskFlags: string[]
  vipScore: "low" | "medium" | "high"
  summary: string
  confidence: number
}

interface CustomerMetrics {
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  totalSpent: number
  avgBookingIntervalDays: number | null
}

interface Props {
  customerId: string
}

const VIP_CONFIG = {
  high: { label: "VIP", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  medium: { label: "Stamkund", className: "bg-blue-100 text-blue-800 border-blue-300" },
  low: { label: "Normal", className: "bg-gray-100 text-gray-600 border-gray-300" },
} as const

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just nu"
  if (minutes < 60) return `${minutes} min sedan`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} tim sedan`
  const days = Math.floor(hours / 24)
  return `${days} dagar sedan`
}

export function CustomerInsightCard({ customerId }: Props) {
  const [insight, setInsight] = useState<CustomerInsight | null>(null)
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchInsight(refresh = false) {
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const url = refresh
        ? `/api/provider/customers/${customerId}/insights?refresh=true`
        : `/api/provider/customers/${customerId}/insights`

      const response = await fetch(url, { method: "POST" })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte generera insikter")
      }

      const data = await response.json()
      setInsight(data.insight)
      setMetrics(data.metrics)
      setCachedAt(data.cachedAt ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte generera insikter")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial state: show button
  if (!insight && !loading && !error) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchInsight()}
        className="w-full text-gray-600 hover:text-green-700 hover:border-green-300"
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        Visa insikter
      </Button>
    )
  }

  // Loading state (first load only)
  if (loading && !insight) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Analyserar kunddata...
      </div>
    )
  }

  // Error state
  if (error && !insight) {
    return (
      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchInsight()}
          className="text-red-600 hover:text-red-700 border-red-200"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Försök igen
        </Button>
      </div>
    )
  }

  if (!insight) return null

  const vip = VIP_CONFIG[insight.vipScore]

  return (
    <div className={`border rounded-lg p-3 bg-gray-50 space-y-3 ${refreshing ? "opacity-60" : ""}`}>
      {/* Header with VIP badge and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-green-600" />
          <span className="text-xs font-medium text-gray-700">AI-insikter</span>
          <button
            onClick={() => fetchInsight(true)}
            disabled={refreshing}
            className="text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
            title="Uppdatera insikter"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${vip.className}`}
        >
          {vip.label}
        </span>
      </div>

      {/* Cache indicator */}
      {cachedAt && (
        <p className="text-xs text-gray-400">
          Uppdaterad {formatRelativeTime(cachedAt)}
        </p>
      )}

      {/* Refresh error (non-blocking) */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* Summary */}
      <p className="text-sm text-gray-700">{insight.summary}</p>

      {/* Frequency & Metrics */}
      <div className="text-xs text-gray-500 space-y-0.5">
        <p>{insight.frequency}</p>
        {metrics && (
          <p>
            {metrics.totalSpent.toLocaleString("sv-SE")} kr totalt
            {metrics.avgBookingIntervalDays &&
              ` / snitt ${metrics.avgBookingIntervalDays} dagar mellan besök`}
          </p>
        )}
      </div>

      {/* Top services */}
      {insight.topServices.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Vanligaste tjänster</p>
          <div className="flex flex-wrap gap-1">
            {insight.topServices.map((s) => (
              <span
                key={s}
                className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Patterns */}
      {insight.patterns.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Mönster</p>
          <ul className="text-xs text-gray-600 space-y-0.5">
            {insight.patterns.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk flags */}
      {insight.riskFlags.length > 0 && (
        <div className="border border-amber-200 rounded p-2 bg-amber-50">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <p className="text-xs font-medium text-amber-700">Varningar</p>
          </div>
          <ul className="text-xs text-amber-700 space-y-0.5">
            {insight.riskFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Low confidence warning */}
      {insight.confidence < 0.5 && (
        <p className="text-xs italic text-gray-400">
          Osäker analys (begränsad data)
        </p>
      )}
    </div>
  )
}
