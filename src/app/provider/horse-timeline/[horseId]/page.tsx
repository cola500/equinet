"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// --- Types ---

interface TimelineItem {
  type: "booking" | "note"
  id: string
  date: string
  title: string
  providerName?: string
  status?: string
  notes?: string | null
  category?: string
  content?: string | null
  authorName?: string
}

// --- Constants ---

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  veterinary: { label: "Veterinär", color: "bg-blue-100 text-blue-800" },
  farrier: { label: "Hovslagare", color: "bg-orange-100 text-orange-800" },
  medication: { label: "Medicin", color: "bg-purple-100 text-purple-800" },
}

// Provider sees only these categories (privacy)
const PROVIDER_FILTER_OPTIONS = [
  { value: "veterinary", label: "Veterinär" },
  { value: "farrier", label: "Hovslagare" },
  { value: "medication", label: "Medicin" },
]

// --- Page Component ---

export default function ProviderHorseTimelinePage() {
  const router = useRouter()
  const params = useParams()
  const horseId = params.horseId as string
  const { isLoading: authLoading, isProvider } = useAuth()

  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [horseName, setHorseName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  const fetchTimeline = useCallback(async () => {
    try {
      const url = activeFilter
        ? `/api/horses/${horseId}/timeline?category=${activeFilter}`
        : `/api/horses/${horseId}/timeline`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setTimeline(data)
      } else if (response.status === 404) {
        toast.error("Hästen hittades inte eller du har inte behörighet")
        router.push("/provider/bookings")
      }
    } catch {
      toast.error("Kunde inte hämta tidslinje")
    } finally {
      setIsLoading(false)
    }
  }, [horseId, activeFilter, router])

  // Fetch horse name separately
  useEffect(() => {
    if (!isProvider || !horseId) return
    fetch(`/api/horses/${horseId}/timeline`)
      .then((res) => {
        if (res.ok) {
          // We don't have a separate endpoint for horse name from provider perspective,
          // so we use the timeline data to infer it
          // The horse name could be passed via query params in the future
        }
      })
      .catch(() => {})
  }, [isProvider, horseId])

  useEffect(() => {
    if (isProvider && horseId) {
      fetchTimeline()
    }
  }, [isProvider, horseId, fetchTimeline])

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
        {/* Back link */}
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Tillbaka
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-2">Hästens hälsohistorik</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Du ser medicinsk historik för hästar du har behandlat.
          Av integritetsskäl visas bara veterinär-, hovslagare- och medicinanteckningar.
        </p>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              activeFilter === null
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Alla
          </button>
          {PROVIDER_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setActiveFilter(activeFilter === opt.value ? null : opt.value)
              }
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                activeFilter === opt.value
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
            <p className="mt-2 text-gray-600">Laddar historik...</p>
          </div>
        ) : timeline.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">Ingen historik att visa.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-4">
              {timeline.map((item) => (
                <ProviderTimelineCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        )}
    </ProviderLayout>
  )
}

// --- Timeline Card (read-only, no edit/delete) ---

function ProviderTimelineCard({ item }: { item: TimelineItem }) {
  const date = new Date(item.date)
  const dateStr = date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  const dotColors: Record<string, string> = {
    booking: "bg-green-500",
    veterinary: "bg-blue-500",
    farrier: "bg-orange-500",
    medication: "bg-purple-500",
  }

  const dotColor =
    item.type === "booking"
      ? dotColors.booking
      : item.category
        ? dotColors[item.category] || "bg-gray-400"
        : "bg-gray-400"

  return (
    <div className="relative pl-10">
      <div
        className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white ${dotColor}`}
      />
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              {item.type === "booking" && item.providerName && (
                <p className="text-sm text-gray-600">{item.providerName}</p>
              )}
              {item.content && (
                <p className="text-sm text-gray-600 mt-1">{item.content}</p>
              )}
              {item.authorName && (
                <p className="text-xs text-gray-400 mt-1">
                  Av {item.authorName}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{dateStr}</p>
              {item.type === "booking" ? (
                <Badge
                  variant="outline"
                  className="mt-1 bg-green-50 text-green-700 border-green-200"
                >
                  Bokning
                </Badge>
              ) : (
                item.category &&
                CATEGORY_LABELS[item.category] && (
                  <Badge
                    variant="outline"
                    className={`mt-1 ${CATEGORY_LABELS[item.category].color}`}
                  >
                    {CATEGORY_LABELS[item.category].label}
                  </Badge>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
