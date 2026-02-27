"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { useHorseNotes } from "@/hooks/useHorseNotes"
import { useServiceIntervals } from "@/hooks/useServiceIntervals"
import { useHorseEdit } from "@/hooks/useHorseEdit"
import { TimelineSection } from "@/components/customer/horses/TimelineSection"
import { IntervalSection } from "@/components/customer/horses/IntervalSection"
import { HorseInfoSection } from "@/components/customer/horses/HorseInfoSection"
import type { Horse, TimelineItem } from "./types"
import { GENDER_LABELS, CATEGORY_OPTIONS } from "./types"

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

  // Tabs
  const dueForServiceEnabled = useFeatureFlag("due_for_service")
  const initialTab = searchParams.get("tab") || "historik"
  const [activeTab, setActiveTab] = useState(initialTab)

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

  // Hooks for dialog state
  const notes = useHorseNotes(horseId, fetchTimeline)
  const intervals = useServiceIntervals(horseId, dueForServiceEnabled)
  const edit = useHorseEdit(horse, fetchHorse)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  /* eslint-disable react-hooks/exhaustive-deps -- intervals is an object ref that changes on every render; fetchIntervals is stable via useCallback inside the hook */
  useEffect(() => {
    if (isCustomer && horseId) {
      fetchHorse()
      fetchTimeline()
      intervals.fetchIntervals()
    }
  }, [isCustomer, horseId, fetchHorse, fetchTimeline, intervals.fetchIntervals])
  /* eslint-enable react-hooks/exhaustive-deps */

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
              onClick={notes.noteDialog.openDialog}
            >
              Lägg till anteckning
            </Button>
          </div>

          {/* Note dialog */}
          <ResponsiveDialog open={notes.noteDialog.open} onOpenChange={notes.noteDialog.setOpen}>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Ny anteckning</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  Lägg till en anteckning i hästens hälsohistorik.
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <form onSubmit={notes.handleAddNote} className="space-y-4">
                <div>
                  <Label htmlFor="note-category">Kategori *</Label>
                  <Select
                    value={notes.noteForm.category}
                    onValueChange={(value) =>
                      notes.setNoteForm({ ...notes.noteForm, category: value })
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
                    value={notes.noteForm.title}
                    onChange={(e) =>
                      notes.setNoteForm({ ...notes.noteForm, title: e.target.value })
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
                    value={notes.noteForm.content}
                    onChange={(e) =>
                      notes.setNoteForm({ ...notes.noteForm, content: e.target.value })
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
                    value={notes.noteForm.noteDate}
                    onChange={(e) =>
                      notes.setNoteForm({ ...notes.noteForm, noteDate: e.target.value })
                    }
                    max={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
                <ResponsiveDialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      notes.isSaving ||
                      !notes.noteForm.category ||
                      !notes.noteForm.title.trim() ||
                      !notes.noteForm.noteDate
                    }
                  >
                    {notes.isSaving ? "Sparar..." : "Lägg till"}
                  </Button>
                </ResponsiveDialogFooter>
              </form>
            </ResponsiveDialogContent>
          </ResponsiveDialog>

          <TimelineSection
            timeline={timeline}
            isLoading={isLoading}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </TabsContent>

        {/* --- Intervall tab --- */}
        {dueForServiceEnabled && (
          <TabsContent value="intervall">
            <IntervalSection
              intervals={intervals.intervals}
              availableServices={intervals.availableServices}
              dialogOpen={intervals.intervalDialog.open}
              onDialogOpenChange={intervals.intervalDialog.setOpen}
              editingInterval={intervals.editingInterval}
              intervalForm={intervals.intervalForm}
              onIntervalFormChange={intervals.setIntervalForm}
              isSaving={intervals.isSavingInterval}
              onSave={intervals.handleSaveInterval}
              onDelete={intervals.handleDeleteInterval}
              onEditInterval={intervals.openEditInterval}
              onNewInterval={intervals.openNewInterval}
              onServiceSelect={intervals.handleServiceSelect}
            />
          </TabsContent>
        )}

        {/* --- Info tab --- */}
        <TabsContent value="info">
          {horse && (
            <HorseInfoSection
              horse={horse}
              editDialogOpen={edit.editDialog.open}
              onEditDialogOpenChange={edit.handleDialogClose}
              editForm={edit.editForm}
              onEditFormChange={edit.setEditForm}
              isSaving={edit.isSavingEdit}
              onOpenEdit={edit.openEditDialog}
              onSave={edit.handleEditHorse}
            />
          )}
        </TabsContent>
      </Tabs>
    </CustomerLayout>
  )
}
