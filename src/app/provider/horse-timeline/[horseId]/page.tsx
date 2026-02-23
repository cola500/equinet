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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { Label } from "@/components/ui/label"
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
  providerNotes?: string | null
  category?: string
  content?: string | null
  authorName?: string
}

interface ProviderHorseInterval {
  id: string
  serviceId: string
  revisitIntervalWeeks: number
  notes: string | null
  service: { id: string; name: string; recommendedIntervalWeeks: number | null }
}

interface AvailableService {
  id: string
  name: string
  recommendedIntervalWeeks: number | null
}

// --- Constants ---

const INTERVAL_OPTIONS = [
  { value: "4", label: "4 veckor" },
  { value: "6", label: "6 veckor" },
  { value: "8", label: "8 veckor" },
  { value: "12", label: "12 veckor" },
  { value: "26", label: "26 veckor (halvår)" },
  { value: "52", label: "52 veckor (1 år)" },
]

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

  // Interval state (now a list per service)
  const [intervals, setIntervals] = useState<ProviderHorseInterval[]>([])
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([])
  const [intervalLoading, setIntervalLoading] = useState(true)
  const [isEditingInterval, setIsEditingInterval] = useState(false)
  const [editingIntervalId, setEditingIntervalId] = useState<string | null>(null) // null = new
  const [editServiceId, setEditServiceId] = useState<string>("")
  const [editWeeks, setEditWeeks] = useState<string>("")
  const [editNotes, setEditNotes] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

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

  // Fetch intervals (now returns list + available services)
  const fetchIntervals = useCallback(async () => {
    try {
      const res = await fetch(`/api/provider/horses/${horseId}/interval`)
      if (res.ok) {
        const data = await res.json()
        setIntervals(data.intervals ?? [])
        setAvailableServices(data.availableServices ?? [])
      }
    } catch {
      // Interval is non-critical -- silently fail
    } finally {
      setIntervalLoading(false)
    }
  }, [horseId])

  useEffect(() => {
    if (isProvider && horseId) {
      fetchIntervals()
    }
  }, [isProvider, horseId, fetchIntervals])

  // Services that don't already have an interval set
  const unusedServices = availableServices.filter(
    (svc) => !intervals.some((i) => i.serviceId === svc.id)
  )

  const startNewInterval = () => {
    setEditingIntervalId(null)
    setEditServiceId("")
    setEditWeeks("")
    setEditNotes("")
    setIsEditingInterval(true)
  }

  const startEditingInterval = (interval: ProviderHorseInterval) => {
    setEditingIntervalId(interval.id)
    setEditServiceId(interval.serviceId)
    setEditWeeks(String(interval.revisitIntervalWeeks))
    setEditNotes(interval.notes ?? "")
    setIsEditingInterval(true)
  }

  const cancelEditing = () => {
    setIsEditingInterval(false)
    setEditingIntervalId(null)
    setEditServiceId("")
    setEditWeeks("")
    setEditNotes("")
  }

  const handleServiceChange = (serviceId: string) => {
    setEditServiceId(serviceId)
    // Auto-fill recommended interval if available
    const svc = availableServices.find((s) => s.id === serviceId)
    if (svc?.recommendedIntervalWeeks) {
      const recommended = String(svc.recommendedIntervalWeeks)
      if (INTERVAL_OPTIONS.some((opt) => opt.value === recommended)) {
        setEditWeeks(recommended)
      }
    }
  }

  const saveInterval = async () => {
    if (!editServiceId) {
      toast.error("Välj en tjänst")
      return
    }
    if (!editWeeks) {
      toast.error("Välj ett intervall")
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/provider/horses/${horseId}/interval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: editServiceId,
          revisitIntervalWeeks: Number(editWeeks),
          notes: editNotes.trim() || null,
        }),
      })
      if (res.ok) {
        await fetchIntervals()
        setIsEditingInterval(false)
        setEditingIntervalId(null)
        toast.success("Intervall sparat")
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error ?? "Kunde inte spara intervall")
      }
    } catch {
      toast.error("Kunde inte spara intervall")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteInterval = async (serviceId: string) => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/provider/horses/${horseId}/interval`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      })
      if (res.ok) {
        await fetchIntervals()
        setIsEditingInterval(false)
        setEditingIntervalId(null)
        toast.success("Intervall borttaget")
      } else {
        toast.error("Kunde inte ta bort intervall")
      }
    } catch {
      toast.error("Kunde inte ta bort intervall")
    } finally {
      setIsSaving(false)
    }
  }

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

        {/* Interval section -- per service */}
        {!intervalLoading && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Återbesöksintervall</CardTitle>
                {!isEditingInterval && unusedServices.length > 0 && (
                  <Button size="sm" variant="outline" onClick={startNewInterval}>
                    Lägg till
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingInterval ? (
                <div className="space-y-3">
                  {/* Service selector -- only for new intervals */}
                  {editingIntervalId === null ? (
                    <div>
                      <Label htmlFor="interval-service">Tjänst</Label>
                      <Select value={editServiceId} onValueChange={handleServiceChange}>
                        <SelectTrigger id="interval-service" className="mt-1">
                          <SelectValue placeholder="Välj tjänst..." />
                        </SelectTrigger>
                        <SelectContent>
                          {unusedServices.map((svc) => (
                            <SelectItem key={svc.id} value={svc.id}>
                              {svc.name}
                              {svc.recommendedIntervalWeeks && (
                                <span className="text-gray-400 ml-1">
                                  (standard: {svc.recommendedIntervalWeeks} v)
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Tjänst: <span className="font-medium">{intervals.find(i => i.id === editingIntervalId)?.service.name}</span>
                    </p>
                  )}
                  <div>
                    <Label htmlFor="interval-weeks">Intervall</Label>
                    <Select value={editWeeks} onValueChange={setEditWeeks}>
                      <SelectTrigger id="interval-weeks" className="mt-1">
                        <SelectValue placeholder="Välj intervall..." />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="interval-notes">Anteckning (valfritt)</Label>
                    <VoiceTextarea
                      id="interval-notes"
                      value={editNotes}
                      onChange={(value) => setEditNotes(value)}
                      maxLength={500}
                      placeholder="T.ex. 'Behöver kortare intervall pga hovproblem'"
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveInterval} disabled={isSaving}>
                      {isSaving ? "Sparar..." : "Spara"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={isSaving}
                    >
                      Avbryt
                    </Button>
                  </div>
                </div>
              ) : intervals.length > 0 ? (
                <div className="space-y-3">
                  {intervals.map((interval) => (
                    <div key={interval.id} className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{interval.service.name}</p>
                        <p className="text-sm text-gray-600">
                          {interval.revisitIntervalWeeks} veckor
                          {interval.service.recommendedIntervalWeeks && (
                            <span className="text-gray-400 ml-1">
                              (standard: {interval.service.recommendedIntervalWeeks} v)
                            </span>
                          )}
                        </p>
                        {interval.notes && (
                          <p className="text-xs text-gray-500 mt-0.5">{interval.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => startEditingInterval(interval)}>
                          Ändra
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteInterval(interval.serviceId)}
                          disabled={isSaving}
                        >
                          Ta bort
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Inga intervall satta. Standardintervall från tjänsterna används.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
              {item.type === "booking" && item.providerNotes && (
                <p className="text-sm text-gray-700 mt-1 bg-blue-50 p-2 rounded">
                  {item.providerNotes}
                </p>
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
