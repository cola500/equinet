"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface AvailableService {
  id: string
  name: string
  recommendedIntervalWeeks: number | null
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

const emptyHorseForm = {
  name: "",
  breed: "",
  birthYear: "",
  color: "",
  gender: "",
  specialNeeds: "",
  registrationNumber: "",
  microchipNumber: "",
}

// --- Page Component ---

export default function HorseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const horseId = params.id as string
  const { isLoading: authLoading, isCustomer } = useAuth()

  const [horse, setHorse] = useState<Horse | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteForm, setNoteForm] = useState(emptyNoteForm)
  const [isSaving, setIsSaving] = useState(false)

  // Edit horse
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState(emptyHorseForm)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Tabs
  const dueForServiceEnabled = useFeatureFlag("due_for_service")
  const initialTab = searchParams.get("tab") || "historik"
  const [activeTab, setActiveTab] = useState(initialTab)

  // Service intervals
  const [intervals, setIntervals] = useState<ServiceInterval[]>([])
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([])
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
        setAvailableServices(data.availableServices ?? [])
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

  const openEditDialog = () => {
    if (!horse) return
    setEditForm({
      name: horse.name,
      breed: horse.breed || "",
      birthYear: horse.birthYear?.toString() || "",
      color: horse.color || "",
      gender: horse.gender || "",
      specialNeeds: horse.specialNeeds || "",
      registrationNumber: horse.registrationNumber || "",
      microchipNumber: horse.microchipNumber || "",
    })
    setEditDialogOpen(true)
  }

  const handleEditHorse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!horse) return
    setIsSavingEdit(true)

    try {
      const body: Record<string, unknown> = { name: editForm.name }
      body.breed = editForm.breed || null
      body.birthYear = editForm.birthYear ? parseInt(editForm.birthYear) : null
      body.color = editForm.color || null
      body.gender = editForm.gender || null
      body.specialNeeds = editForm.specialNeeds || null
      body.registrationNumber = editForm.registrationNumber || null
      body.microchipNumber = editForm.microchipNumber || null

      const response = await fetch(`/api/horses/${horse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte uppdatera häst")
      }

      toast.success("Hästen har uppdaterats!")
      setEditDialogOpen(false)
      setEditForm(emptyHorseForm)
      fetchHorse()
    } catch (error) {
      console.error("Error updating horse:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera häst")
    } finally {
      setIsSavingEdit(false)
    }
  }

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

  const handleDeleteInterval = async (serviceId: string, serviceName: string) => {
    if (!window.confirm(`Ta bort intervall för ${serviceName}?`)) return

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === "historik") {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", tab)
    }
    window.history.replaceState(null, "", url.toString())
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

  const handleServiceSelect = (serviceId: string) => {
    const service = availableServices.find((s) => s.id === serviceId)
    setIntervalForm({
      serviceId,
      intervalWeeks: service?.recommendedIntervalWeeks
        ? String(service.recommendedIntervalWeeks)
        : intervalForm.intervalWeeks,
    })
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

      {/* Horse header -- always visible above tabs */}
      {horse && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
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
              <h1 className="text-2xl font-bold">{horse.name}</h1>
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
          <ShareProfileDialog horseId={horse.id} horseName={horse.name} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-col">
        <TabsList>
          <TabsTrigger value="historik">Historik</TabsTrigger>
          {dueForServiceEnabled && (
            <TabsTrigger value="intervall">Intervall</TabsTrigger>
          )}
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        {/* --- Historik tab --- */}
        <TabsContent value="historik">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold">Historik</h2>
            <Button
              className="w-full sm:w-auto"
              onClick={() => setNoteDialogOpen(true)}
            >
              Lägg till anteckning
            </Button>
          </div>

          {/* Note dialog */}
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
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {timeline.map((item) => (
                  <TimelineCard key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* --- Intervall tab --- */}
        {dueForServiceEnabled && (
          <TabsContent value="intervall">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Serviceintervall</h2>
              <Button variant="outline" size="sm" onClick={openNewInterval}>
                Lägg till
              </Button>
            </div>

            {intervals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-600 mb-2">
                    Inga serviceintervall satta.
                  </p>
                  <p className="text-sm text-gray-500">
                    Lägg till för att få påminnelser när det är dags för service.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {intervals.map((interval) => (
                  <Card key={interval.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{interval.service.name}</p>
                          <p className="text-sm text-gray-600">
                            Var {interval.intervalWeeks} vecka{interval.intervalWeeks !== 1 ? "r" : ""}
                          </p>
                          {interval.service.recommendedIntervalWeeks && (
                            <p className="text-xs text-gray-400">
                              Leverantörens rekommendation: {interval.service.recommendedIntervalWeeks} veckor
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditInterval(interval)}
                          >
                            Ändra
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteInterval(interval.serviceId, interval.service.name)}
                          >
                            Ta bort
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Interval Dialog */}
            <ResponsiveDialog open={intervalDialogOpen} onOpenChange={setIntervalDialogOpen}>
              <ResponsiveDialogContent>
                <ResponsiveDialogHeader>
                  <ResponsiveDialogTitle>
                    {editingInterval ? "Ändra serviceintervall" : "Lägg till serviceintervall"}
                  </ResponsiveDialogTitle>
                  <ResponsiveDialogDescription>
                    Ange hur ofta denna tjänst ska utföras. Du får en påminnelse när det är dags.
                  </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <form onSubmit={handleSaveInterval} className="space-y-4">
                  {!editingInterval && (
                    <div>
                      <Label htmlFor="interval-service">Tjänst *</Label>
                      {availableServices.length > 0 ? (
                        <Select
                          value={intervalForm.serviceId}
                          onValueChange={handleServiceSelect}
                        >
                          <SelectTrigger id="interval-service">
                            <SelectValue placeholder="Välj tjänst..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableServices.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">
                          Inga tjänster hittades. Boka en tjänst först så dyker den upp här.
                        </p>
                      )}
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
                      1-104 veckor. T.ex. 6 veckor för hovslagare, 26 veckor för tandvård.
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
          </TabsContent>
        )}

        {/* --- Info tab --- */}
        <TabsContent value="info">
          {horse && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Hästinformation</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openEditDialog}
                >
                  Redigera
                </Button>
              </div>

              <Card>
                <CardContent className="py-4 space-y-4">
                  <InfoRow label="Namn" value={horse.name} />
                  <InfoRow label="Ras" value={horse.breed} />
                  <InfoRow label="Färg" value={horse.color} />
                  <InfoRow
                    label="Kön"
                    value={horse.gender ? GENDER_LABELS[horse.gender] || horse.gender : null}
                  />
                  <InfoRow
                    label="Födelseår"
                    value={horse.birthYear ? String(horse.birthYear) : null}
                  />
                  <InfoRow label="UELN" value={horse.registrationNumber} />
                  <InfoRow label="Chipnummer" value={horse.microchipNumber} />
                </CardContent>
              </Card>

              {horse.specialNeeds && (
                <Card>
                  <CardContent className="py-4">
                    <div className="bg-amber-50 p-3 rounded text-sm text-amber-800">
                      <span className="font-medium">Specialbehov:</span>{" "}
                      {horse.specialNeeds}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit horse dialog */}
      <ResponsiveDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialogOpen(false)
            setEditForm(emptyHorseForm)
          }
        }}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Redigera {horse?.name}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Uppdatera information om din häst.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleEditHorse} className="space-y-4">
            <div>
              <Label htmlFor="edit-horse-name">Namn *</Label>
              <Input
                id="edit-horse-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-horse-breed">Ras</Label>
                <Input
                  id="edit-horse-breed"
                  value={editForm.breed}
                  onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-horse-color">Färg</Label>
                <Input
                  id="edit-horse-color"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-horse-birthYear">Födelseår</Label>
                <Input
                  id="edit-horse-birthYear"
                  type="number"
                  value={editForm.birthYear}
                  onChange={(e) => setEditForm({ ...editForm, birthYear: e.target.value })}
                  min={1980}
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <Label htmlFor="edit-horse-gender">Kön</Label>
                <Select
                  value={editForm.gender}
                  onValueChange={(v) => setEditForm({ ...editForm, gender: v })}
                >
                  <SelectTrigger id="edit-horse-gender">
                    <SelectValue placeholder="Välj kön" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mare">Sto</SelectItem>
                    <SelectItem value="gelding">Valack</SelectItem>
                    <SelectItem value="stallion">Hingst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-horse-regnum">Registreringsnummer</Label>
                <Input
                  id="edit-horse-regnum"
                  value={editForm.registrationNumber}
                  onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-horse-chip">Chipnummer</Label>
                <Input
                  id="edit-horse-chip"
                  value={editForm.microchipNumber}
                  onChange={(e) => setEditForm({ ...editForm, microchipNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-horse-needs">Speciella behov</Label>
              <Textarea
                id="edit-horse-needs"
                value={editForm.specialNeeds}
                onChange={(e) => setEditForm({ ...editForm, specialNeeds: e.target.value })}
                rows={3}
              />
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={isSavingEdit || !editForm.name.trim()}>
                {isSavingEdit ? "Sparar..." : "Spara ändringar"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </CustomerLayout>
  )
}

// --- Info Row ---

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between py-1 border-b last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value || "-"}</span>
    </div>
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
