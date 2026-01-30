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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { SharePassportDialog } from "./SharePassportDialog"
import { ImageUpload } from "@/components/ui/image-upload"

// --- Types ---

interface Horse {
  id: string
  name: string
  breed: string | null
  birthYear: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
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

export default function HorseProfilePage() {
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

  useEffect(() => {
    if (isCustomer && horseId) {
      fetchHorse()
      fetchTimeline()
    }
  }, [isCustomer, horseId, fetchHorse, fetchTimeline])

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
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <ImageUpload
                  bucket="horses"
                  entityId={horse.id}
                  currentUrl={horse.photoUrl}
                  onUploaded={(url) => setHorse({ ...horse, photoUrl: url })}
                  className="w-32 flex-shrink-0"
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
                </div>
              </div>
              <SharePassportDialog horseId={horse.id} horseName={horse.name} />
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

      {/* Timeline controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold">Historik</h2>
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogTrigger asChild>
            <Button>Lägg till anteckning</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ny anteckning</DialogTitle>
              <DialogDescription>
                Lägg till en anteckning i hästens hälsohistorik.
              </DialogDescription>
            </DialogHeader>
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
              <DialogFooter>
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
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category filter chips */}
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
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat.value}
            onClick={() =>
              setActiveFilter(activeFilter === cat.value ? null : cat.value)
            }
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
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
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-600">{item.providerName}</p>
                {item.notes && (
                  <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                )}
              </div>
              <div className="text-right">
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
          <div className="flex items-start justify-between">
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
            <div className="text-right">
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
