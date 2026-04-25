"use client"

import { useState } from "react"
import useSWR from "swr"
import { useAuth } from "@/hooks/useAuth"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { OfflineErrorState } from "@/components/ui/OfflineErrorState"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { GenericListSkeleton } from "@/components/loading/GenericListSkeleton"
import { Clock, AlertTriangle, CheckCircle, CalendarPlus, Check, X } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { HorseIcon } from "@/components/icons/HorseIcon"

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
  const [filter, setFilter] = useState<Filter>("all")
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>("")
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const swrKey = isProvider
    ? `/api/provider/due-for-service${filter !== "all" ? `?filter=${filter}` : ""}`
    : null
  const { data, error: swrError, isLoading, mutate: mutateDueItems } = useSWR<{ items: DueForServiceItem[] }>(swrKey)
  const items = data?.items ?? []
  const fetchError = !!swrError

  const startEdit = (item: DueForServiceItem) => {
    setEditingKey(`${item.horseId}:${item.serviceId}`)
    setEditingValue(String(item.intervalWeeks))
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditingValue("")
  }

  const saveInterval = async (item: DueForServiceItem) => {
    const weeks = Number(editingValue)
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      toast.error("Intervallet måste vara 1–52 veckor")
      return
    }
    const key = `${item.horseId}:${item.serviceId}`
    setSavingKey(key)
    try {
      const res = await fetch(`/api/provider/horses/${item.horseId}/interval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: item.serviceId, revisitIntervalWeeks: weeks }),
      })
      if (!res.ok) {
        toast.error("Kunde inte spara intervallet")
        return
      }
      toast.success("Sparat")
      setEditingKey(null)
      await mutateDueItems()
    } catch {
      toast.error("Kunde inte spara intervallet")
    } finally {
      setSavingKey(null)
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
        <GenericListSkeleton />
      </ProviderLayout>
    )
  }

  const overdueCount = items.filter((i) => i.status === "overdue").length
  const upcomingCount = items.filter((i) => i.status === "upcoming").length

  return (
    <ProviderLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HorseIcon className="h-8 w-8 text-primary" />
          Besöksplanering
        </h1>
        <p className="text-gray-600 mt-1">
          Hästar som snart behöver besök, sorterade efter angelägenhet
        </p>
      </div>

      {fetchError && !isOnline && (
        <div className="mb-6">
          <OfflineErrorState onRetry={() => mutateDueItems()} />
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
            aria-pressed={filter === f}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
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
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-500 flex-1">
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
                        {editingKey === `${item.horseId}:${item.serviceId}` ? (
                          <div className="flex items-center gap-1 mt-1">
                            <Input
                              type="number"
                              min={1}
                              max={52}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="h-7 w-16 px-2 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveInterval(item)
                                if (e.key === "Escape") cancelEdit()
                              }}
                            />
                            <span className="text-xs">v</span>
                            <button
                              type="button"
                              onClick={() => saveInterval(item)}
                              disabled={savingKey === `${item.horseId}:${item.serviceId}`}
                              className="text-green-600 hover:text-green-700 disabled:opacity-50"
                              aria-label="Spara intervall"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="text-gray-400 hover:text-gray-600"
                              aria-label="Avbryt"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="hover:text-primary hover:underline cursor-pointer text-left"
                            title="Klicka för att ändra intervall"
                          >
                            {item.intervalWeeks} veckor
                          </button>
                        )}
                      </div>
                      <div>
                        <span className="block text-xs uppercase tracking-wider">
                          Nästa besök
                        </span>
                        <span>{formatDate(item.dueDate)}</span>
                      </div>
                    </div>
                    {isOnline ? (
                      <Button size="sm" variant="outline" asChild className="shrink-0">
                        <Link href="/provider/calendar">
                          <CalendarPlus className="h-4 w-4 mr-1" />
                          Boka
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled
                        title="Inte tillgängligt offline"
                      >
                        <CalendarPlus className="h-4 w-4 mr-1" />
                        Boka
                      </Button>
                    )}
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
