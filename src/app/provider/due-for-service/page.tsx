"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { OfflineErrorState } from "@/components/ui/OfflineErrorState"
import { Card, CardContent } from "@/components/ui/card"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Clock, AlertTriangle, CheckCircle } from "lucide-react"

interface DueForServiceItem {
  horseId: string
  horseName: string
  ownerName: string
  serviceName: string
  serviceId: string
  lastServiceDate: string
  daysSinceService: number
  intervalWeeks: number
  dueDate: string
  daysUntilDue: number
  status: "overdue" | "upcoming" | "ok"
}

type Filter = "all" | "overdue" | "upcoming"

const statusConfig = {
  overdue: {
    label: "Försenad",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    icon: AlertTriangle,
  },
  upcoming: {
    label: "Inom 2 veckor",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    icon: Clock,
  },
  ok: {
    label: "Ej aktuell",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    icon: CheckCircle,
  },
}

export default function DueForServicePage() {
  const { isLoading: authLoading, isProvider } = useAuth()
  const isOnline = useOnlineStatus()
  const [items, setItems] = useState<DueForServiceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")

  useEffect(() => {
    if (isProvider) {
      fetchDueItems()
    }
  }, [isProvider, filter])

  const fetchDueItems = async () => {
    setIsLoading(true)
    setFetchError(false)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("filter", filter)

      const response = await fetch(`/api/provider/due-for-service?${params}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
      } else {
        setFetchError(true)
      }
    } catch (error) {
      console.error("Failed to fetch due-for-service:", error)
      setFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDaysUntilDue = (days: number) => {
    if (days < 0) {
      const overdueDays = Math.abs(days)
      return `${overdueDays} ${overdueDays === 1 ? "dag" : "dagar"} försenad`
    }
    if (days === 0) return "Idag"
    return `om ${days} ${days === 1 ? "dag" : "dagar"}`
  }

  if (authLoading || !isProvider) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  const overdueCount = items.filter((i) => i.status === "overdue").length
  const upcomingCount = items.filter((i) => i.status === "upcoming").length

  return (
    <ProviderLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Besöksplanering</h1>
        <p className="text-gray-600 mt-1">
          Hästar som snart behöver besök, sorterade efter angelägenhet
        </p>
      </div>

      {fetchError && !isOnline && (
        <div className="mb-6">
          <OfflineErrorState onRetry={fetchDueItems} />
        </div>
      )}

      {/* Summary cards */}
      {!isLoading && !fetchError && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="border-red-200">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                <p className="text-sm text-gray-500">Försenade</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{upcomingCount}</p>
                <p className="text-sm text-gray-500">Inom 2 veckor</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["all", "overdue", "upcoming"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "Alla" : f === "overdue" ? "Försenade" : "Inom 2 veckor"}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar besöksplanering...</p>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {filter !== "all"
              ? "Inga hästar matchar filtret."
              : "Inga hästar behöver besök just nu. Hästar dyker upp här efter avslutade bokningar med tjänster som har återbesöksintervall."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const config = statusConfig[item.status]
            const StatusIcon = config.icon

            return (
              <Card key={`${item.horseId}-${item.serviceId}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center`}
                      >
                        <StatusIcon className={`h-5 w-5 ${config.textColor}`} />
                      </div>
                      <div>
                        <h3 className="font-medium">{item.horseName}</h3>
                        <p className="text-sm text-gray-500">
                          {item.ownerName} - {item.serviceName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
                      >
                        {config.label}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDaysUntilDue(item.daysUntilDue)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm text-gray-500">
                    <div>
                      <span className="block text-xs uppercase tracking-wider">
                        Senaste besök
                      </span>
                      <span>{formatDate(item.lastServiceDate)}</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider">
                        Intervall
                      </span>
                      <span>{item.intervalWeeks} veckor</span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider">
                        Nästa besök
                      </span>
                      <span>{formatDate(item.dueDate)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </ProviderLayout>
  )
}
