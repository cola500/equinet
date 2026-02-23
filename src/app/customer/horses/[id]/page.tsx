"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { ShareProfileDialog } from "./ShareProfileDialog"
import { ImageUpload } from "@/components/ui/image-upload"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

// --- Types ---

interface Horse {
  id: string
  name: string
  breed: string | null
  birthYear: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
  registrationNumber: string | null
  microchipNumber: string | null
  photoUrl: string | null
}

interface TimelineItem {
  type: "booking" | "note"
  id: string
  date: string
  title: string
  // Booking fields
  providerName?: string
  status?: string
  notes?: string | null
  // Note fields
  category?: string
  content?: string | null
  authorName?: string
}

interface ServiceInterval {
  id: string
  serviceId: string
  intervalWeeks: number
  service: {
    id: string
    name: string
    recommendedIntervalWeeks: number | null
  }
}

// --- Constants ---

const GENDER_LABELS: Record<string, string> = {
  mare: "Sto",
  gelding: "Valack",
  stallion: "Hingst",
}

const CATEGORY_OPTIONS = [
  { value: "veterinary", label: "Veterinär", color: "bg-blue-100 text-blue-800" },
  { value: "farrier", label: "Hovslagare", color: "bg-orange-100 text-orange-800" },
  { value: "general", label: "Allmänt", color: "bg-gray-100 text-gray-800" },
  { value: "injury", label: "Skada", color: "bg-red-100 text-red-800" },
  { value: "medication", label: "Medicin", color: "bg-purple-100 text-purple-800" },
] as const

const CATEGORY_MAP = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c])
)

const emptyNoteForm = {
  category: "",
  title: "",
  content: "",
  noteDate: new Date().toISOString().split("T")[0],
}

// --- Page Component ---

export default function HorseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const horseId = params.id as string
  const { isLoading: authLoading, isCustomer } = useAuth()

  const [horse, setHorse] = useState<Horse | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteForm, setNoteForm] = useState(emptyNoteForm)
  const [isSaving, setIsSaving] = useState(false)

  // Service intervals
  const dueForServiceEnabled = useFeatureFlag("due_for_service")
  const [intervals, setIntervals] = useState<ServiceInterval[]>([])
  const [intervalDialogOpen, setIntervalDialogOpen] = useState(false)
  const [editingInterval, setEditingInterval] = useState<ServiceInterval | null>(null)
  const [intervalForm, setIntervalForm] = useState({ serviceId: "", intervalWeeks: "" })
  const [isSavingInterval, setIsSavingInterval] = useState(false)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const fetchHorse = useCallback(async () => {
    try {
      const response = await fetch(`/api/horses/${horseId}`)
      if (response.ok) {
        const data = await response.json()
        setHorse(data)
      } else {
        toast.error("Kunde inte hämta häst")
        router.push("/customer/horses")
      }
    } catch {
      toast.error("Kunde inte hämta häst")
    }
  }, [horseId, router])

  const fetchTimeline = useCallback(async () => {
    try {
      const url = activeFilter
        ? `/api/horses/${horseId}/timeline?category=${activeFilter}`
        : `/api/horses/${horseId}/timeline`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setTimeline(data)
      }
    } catch {
      toast.error("Kunde inte hämta tidslinje")
    } finally {
      setIsLoading(false)
    }
  }, [horseId, activeFilter])

  const fetchIntervals = useCallback(async () => {
    if (!dueForServiceEnabled) return
    try {
      const response = await fetch(`/api/customer/horses/${horseId}/intervals`)
      if (response.ok) {
        const data = await response.json()
        setIntervals(data.intervals ?? [])
      }
    } catch {
      // Silent -- intervals are supplementary
    }
  }, [horseId, dueForServiceEnabled])

  useEffect(() => {
    if (isCustomer && horseId) {
      fetchHorse()
      fetchTimeline()
      fetchIntervals()
    }
  }, [isCustomer, horseId, fetchHorse, fetchTimeline, fetchIntervals])

  const handleSaveInterval = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingInterval(true)

    try {
      const response = await fetch(`/api/customer/horses/${horseId}/intervals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: intervalForm.serviceId,
          intervalWeeks: Number(intervalForm.intervalWeeks),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte spara intervall")
      }

      toast.success(editingInterval ? "Intervall uppdaterat!" : "Intervall tillagt!")
      setIntervalDialogOpen(false)
      setEditingInterval(null)
      setIntervalForm({ serviceId: "", intervalWeeks: "" })
      fetchIntervals()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte spara intervall"
      )
    } finally {
      setIsSavingInterval(false)
    }
  }

  const handleDeleteInterval = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/customer/horses/${horseId}/intervals`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte ta bort intervall")
      }

      toast.success("Intervall borttaget!")
      fetchIntervals()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte ta bort intervall"
      )
    }
  }

  const openEditInterval = (interval: ServiceInterval) => {
    setEditingInterval(interval)
    setIntervalForm({
      serviceId: interval.serviceId,
      intervalWeeks: String(interval.intervalWeeks),
    })
    setIntervalDialogOpen(true)
  }

  const openNewInterval = () => {
    setEditingInterval(null)
    setIntervalForm({ serviceId: "", intervalWeeks: "" })
    setIntervalDialogOpen(true)
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch(`/api/horses/${horseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: noteForm.category,
          title: noteForm.title,
          content: noteForm.content || undefined,
          noteDate: new Date(noteForm.noteDate).toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa anteckning")
      }

      toast.success("Anteckning tillagd!")
      setNoteDialogOpen(false)
      setNoteForm(emptyNoteForm)
      fetchTimeline()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skapa anteckning"
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading || !isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <CustomerLayout>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/customer/horses"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Tillbaka till mina hästar
        </Link>
      </div>

      {/* Horse header */}
      {horse && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <ImageUpload
                  bucket="horses"
                  entityId={horse.id}
                  currentUrl={horse.photoUrl}
                  onUploaded={(url) => setHorse({ ...horse, photoUrl: url })}
                  variant="square"
                  className="w-20 sm:w-32 flex-shrink-0"
                />
                <div>
                  <CardTitle className="text-2xl">{horse.name}</CardTitle>
                  <p className="text-gray-600">
                    {[
                      horse.breed,
                      horse.color,
                      horse.gender && GENDER_LABELS[horse.gender],
                      horse.birthYear && `f. ${horse.birthYear}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Ingen extra info"}
                  </p>
                  {(horse.registrationNumber || horse.microchipNumber) && (
                    <p className="text-sm text-gray-500 mt-1 font-mono">
                      {[
                        horse.registrationNumber && `UELN: ${horse.registrationNumber}`,
                        horse.microchipNumber && `Chip: ${horse.microchipNumber}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <ShareProfileDialog horseId={horse.id} horseName={horse.name} />
            </div>
          </CardHeader>
          {horse.specialNeeds && (
            <CardContent>
              <div className="bg-amber-50 p-3 rounded text-sm text-amber-800">
                <span className="font-medium">Specialbehov:</span>{" "}
                {horse.specialNeeds}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Service Intervals */}
      {dueForServiceEnabled && horse && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Serviceintervall</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={openNewInterval}
              >
                Lagg till
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {intervals.length === 0 ? (
              <p className="text-sm text-gray-500">
                Inga serviceintervall satta. Lagg till for att fa paminnelser nar det ar dags for service.
              </p>
            ) : (
              <div className="space-y-3">
                {intervals.map((interval) => (
                  <div
                    key={interval.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{interval.service.name}</p>
                      <p className="text-sm text-gray-600">
                        Var {interval.intervalWeeks} vecka{interval.intervalWeeks !== 1 ? "r" : ""}
                      </p>
                      {interval.service.recommendedIntervalWeeks && (
                        <p className="text-xs text-gray-400">
                          Leverantorens rekommendation: {interval.service.recommendedIntervalWeeks} veckor
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditInterval(interval)}
                      >
                        Andra
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteInterval(interval.serviceId)}
                      >
                        Ta bort
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interval Dialog */}
      <ResponsiveDialog open={intervalDialogOpen} onOpenChange={setIntervalDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editingInterval ? "Andra serviceintervall" : "Lagg till serviceintervall"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Ange hur ofta denna tjanst ska utforas. Du far en paminnelse nar det ar dags.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleSaveInterval} className="space-y-4">
            {!editingInterval && (
              <div>
                <Label htmlFor="interval-service">Tjanst-ID *</Label>
                <Input
                  id="interval-service"
                  value={intervalForm.serviceId}
                  onChange={(e) =>
                    setIntervalForm({ ...intervalForm, serviceId: e.target.value })
                  }
                  placeholder="Klistra in tjanst-ID fran bokningshistorik"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Du hittar tjanst-ID i dina bokningsdetaljer.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="interval-weeks">Intervall (veckor) *</Label>
              <Input
                id="interval-weeks"
                type="number"
                min={1}
                max={104}
                value={intervalForm.intervalWeeks}
                onChange={(e) =>
                  setIntervalForm({ ...intervalForm, intervalWeeks: e.target.value })
                }
                placeholder="T.ex. 6"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                1-104 veckor. T.ex. 6 veckor for hovslagare, 26 veckor for tandvard.
              </p>
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="submit"
                disabled={
                  isSavingInterval ||
                  !intervalForm.serviceId.trim() ||
                  !intervalForm.intervalWeeks ||
                  Number(intervalForm.intervalWeeks) < 1 ||
                  Number(intervalForm.intervalWeeks) > 104
                }
              >
                {isSavingInterval ? "Sparar..." : "Spara"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Timeline controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold">Historik</h2>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setNoteDialogOpen(true)}
        >
          Lägg till anteckning
        </Button>
      </div>

      <ResponsiveDialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Ny anteckning</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Lägg till en anteckning i hästens hälsohistorik.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4">
            <div>
              <Label htmlFor="note-category">Kategori *</Label>
              <Select
                value={noteForm.category}
                onValueChange={(value) =>
                  setNoteForm({ ...noteForm, category: value })
                }
              >
                <SelectTrigger id="note-category">
                  <SelectValue placeholder="Välj kategori..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="note-title">Titel *</Label>
              <Input
                id="note-title"
                value={noteForm.title}
                onChange={(e) =>
                  setNoteForm({ ...noteForm, title: e.target.value })
                }
                placeholder="T.ex. Vaccination - influensa"
                required
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="note-content">Beskrivning</Label>
              <Textarea
                id="note-content"
                value={noteForm.content}
                onChange={(e) =>
                  setNoteForm({ ...noteForm, content: e.target.value })
                }
                placeholder="Valfri beskrivning..."
                rows={3}
                maxLength={2000}
              />
            </div>
            <div>
              <Label htmlFor="note-date">Datum *</Label>
              <Input
                id="note-date"
                type="date"
                value={noteForm.noteDate}
                onChange={(e) =>
                  setNoteForm({ ...noteForm, noteDate: e.target.value })
                }
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !noteForm.category ||
                  !noteForm.title.trim() ||
                  !noteForm.noteDate
                }
              >
                {isSaving ? "Sparar..." : "Lägg till"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveFilter(null)}
          className={`px-3 py-1 touch-target rounded-full text-sm border transition-colors ${
            activeFilter === null
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Alla
        </button>
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.value}
            onClick={() =>
              setActiveFilter(activeFilter === cat.value ? null : cat.value)
            }
            className={`px-3 py-1 touch-target rounded-full text-sm border transition-colors ${
              activeFilter === cat.value
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {cat.label}
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
            <p className="text-gray-600 mb-2">
              Ingen historik att visa ännu.
            </p>
            <p className="text-sm text-gray-500">
              Anteckningar och genomförda bokningar visas här.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {timeline.map((item) => (
              <TimelineCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

// --- Timeline Card ---

function TimelineCard({ item }: { item: TimelineItem }) {
  const date = new Date(item.date)
  const dateStr = date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  if (item.type === "booking") {
    return (
      <div className="relative pl-10">
        <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-600">{item.providerName}</p>
                {item.notes && (
                  <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-gray-500">{dateStr}</p>
                <Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-200">
                  Bokning
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Note
  const cat = item.category ? CATEGORY_MAP[item.category] : null
  const dotColors: Record<string, string> = {
    veterinary: "bg-blue-500",
    farrier: "bg-orange-500",
    general: "bg-gray-400",
    injury: "bg-red-500",
    medication: "bg-purple-500",
  }

  return (
    <div className="relative pl-10">
      <div
        className={`absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white ${
          item.category ? dotColors[item.category] || "bg-gray-400" : "bg-gray-400"
        }`}
      />
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">{item.title}</p>
              {item.content && (
                <p className="text-sm text-gray-600 mt-1">{item.content}</p>
              )}
              {item.authorName && (
                <p className="text-xs text-gray-400 mt-1">
                  Av {item.authorName}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-gray-500">{dateStr}</p>
              {cat && (
                <Badge variant="outline" className={`mt-1 ${cat.color}`}>
                  {cat.label}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
