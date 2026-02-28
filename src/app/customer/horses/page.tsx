"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { useHorses as useSWRHorses } from "@/hooks/useHorses"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { ImageUpload } from "@/components/ui/image-upload"
import { HorseCardSkeleton } from "@/components/loading/HorseCardSkeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { useDueForService } from "@/hooks/useDueForService"
import { AlertTriangle, Clock } from "lucide-react"
import { HorseIcon } from "@/components/icons/HorseIcon"
import type { DueForServiceResult } from "@/domain/due-for-service/DueForServiceCalculator"

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
  createdAt: string
}

const GENDER_LABELS: Record<string, string> = {
  mare: "Sto",
  gelding: "Valack",
  stallion: "Hingst",
}

const emptyForm = {
  name: "",
  breed: "",
  birthYear: "",
  color: "",
  gender: "",
  specialNeeds: "",
  registrationNumber: "",
  microchipNumber: "",
}

export default function CustomerHorsesPage() {
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const { horses, isLoading, mutate: mutateHorses } = useSWRHorses()
  const { items: dueItems } = useDueForService()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [horseToDelete, setHorseToDelete] = useState<Horse | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const body: Record<string, unknown> = { name: formData.name }
      if (formData.breed) body.breed = formData.breed
      if (formData.birthYear) body.birthYear = parseInt(formData.birthYear)
      if (formData.color) body.color = formData.color
      if (formData.gender) body.gender = formData.gender
      if (formData.specialNeeds) body.specialNeeds = formData.specialNeeds
      if (formData.registrationNumber) body.registrationNumber = formData.registrationNumber
      if (formData.microchipNumber) body.microchipNumber = formData.microchipNumber

      const response = await fetch("/api/horses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte lägga till häst")
      }

      toast.success("Hästen har lagts till!")
      setAddDialogOpen(false)
      setFormData(emptyForm)
      mutateHorses()
    } catch (error) {
      console.error("Error adding horse:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till häst")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (horse: Horse) => {
    try {
      const response = await fetch(`/api/horses/${horse.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Kunde inte ta bort häst")
      }

      toast.success(`${horse.name} har tagits bort`)
      setHorseToDelete(null)
      mutateHorses()
    } catch (error) {
      console.error("Error deleting horse:", error)
      toast.error("Kunde inte ta bort häst")
    }
  }

  if (authLoading || !isCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <CustomerLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-3xl font-bold">Mina hästar</h1>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setAddDialogOpen(true)}
        >
          Lägg till häst
        </Button>
      </div>

      <ResponsiveDialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Lägg till häst</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Fyll i information om din häst. Namn är obligatoriskt, resten är valfritt.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <HorseForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAdd}
            isSaving={isSaving}
            submitLabel="Lägg till"
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {isLoading ? (
        <HorseCardSkeleton count={3} />
      ) : horses.length === 0 ? (
        <EmptyState
          icon={HorseIcon}
          title="Inga hästar registrerade"
          description="Lägg till dina hästar för att enkelt välja dem vid bokning och se deras vårdhistorik."
          action={{ label: "Lägg till din första häst", onClick: () => setAddDialogOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {horses.map((horse, index) => (
            <Card key={horse.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <ImageUpload
                    bucket="horses"
                    entityId={horse.id}
                    currentUrl={horse.photoUrl}
                    onUploaded={() => mutateHorses()}
                    variant="square"
                    className="w-20 flex-shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{horse.name}</CardTitle>
                      <DueStatusBadge dueItems={dueItems} horseId={horse.id} />
                    </div>
                    <CardDescription>
                      {[
                        horse.breed,
                        horse.color,
                        horse.gender && GENDER_LABELS[horse.gender],
                        horse.birthYear && `f. ${horse.birthYear}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Ingen extra info"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {horse.specialNeeds && (
                  <p className="text-sm text-gray-600 mb-4 bg-amber-50 p-2 rounded">
                    {horse.specialNeeds}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/customer/horses/${horse.id}`}>
                    <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
                      Information
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] sm:min-h-0 text-red-600 hover:text-red-700"
                    onClick={() => setHorseToDelete(horse)}
                  >
                    Ta bort
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {horseToDelete && (
        <ResponsiveAlertDialog
          open={true}
          onOpenChange={(open) => { if (!open) setHorseToDelete(null) }}
        >
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>Ta bort {horseToDelete.name}?</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                Hästen tas bort från din lista men befintliga bokningar
                påverkas inte. Du kan lägga till hästen igen senare.
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel onClick={() => setHorseToDelete(null)}>Avbryt</ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction
                onClick={() => handleDelete(horseToDelete)}
                className="bg-red-600 hover:bg-red-700"
              >
                Ta bort
              </ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      )}
    </CustomerLayout>
  )
}

// --- Due Status Badge ---

function DueStatusBadge({
  dueItems,
  horseId,
}: {
  dueItems: DueForServiceResult[]
  horseId: string
}) {
  // Find the most urgent due item for this horse
  const item = dueItems.find((i) => i.horseId === horseId)
  if (!item) return null

  if (item.status === "overdue") {
    const days = Math.abs(item.daysUntilDue)
    const label = days === 1 ? "1 dag" : `${days} dagar`
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 gap-1">
        <AlertTriangle className="h-3 w-3" />
        <span>{item.serviceName}: {label} försenad</span>
      </Badge>
    )
  }

  if (item.status === "upcoming") {
    const days = item.daysUntilDue
    const label = days === 0 ? "Idag" : days === 1 ? "1 dag kvar" : `${days} dagar kvar`
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 gap-1">
        <Clock className="h-3 w-3" />
        <span>{item.serviceName}: {label}</span>
      </Badge>
    )
  }

  return null
}

// ---  Horse Form (shared between add/edit) ---

interface HorseFormProps {
  formData: typeof emptyForm
  setFormData: (data: typeof emptyForm) => void
  onSubmit: (e: React.FormEvent) => void
  isSaving: boolean
  submitLabel: string
}

function HorseForm({ formData, setFormData, onSubmit, isSaving, submitLabel }: HorseFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="horse-name">Namn *</Label>
        <Input
          id="horse-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="T.ex. Blansen"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="horse-breed">Ras</Label>
          <Input
            id="horse-breed"
            value={formData.breed}
            onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
            placeholder="T.ex. Svenskt varmblod"
          />
        </div>
        <div>
          <Label htmlFor="horse-color">Färg</Label>
          <Input
            id="horse-color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            placeholder="T.ex. Brun"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="horse-birthYear">Födelseår</Label>
          <Input
            id="horse-birthYear"
            type="number"
            value={formData.birthYear}
            onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
            placeholder="T.ex. 2018"
            min={1980}
            max={new Date().getFullYear()}
          />
        </div>
        <div>
          <Label htmlFor="horse-gender">Kön</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => setFormData({ ...formData, gender: value })}
          >
            <SelectTrigger id="horse-gender">
              <SelectValue placeholder="Välj..." />
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
          <Label htmlFor="horse-registrationNumber">Registreringsnummer (UELN)</Label>
          <Input
            id="horse-registrationNumber"
            value={formData.registrationNumber}
            onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
            placeholder="T.ex. 752009876543210"
            maxLength={15}
          />
        </div>
        <div>
          <Label htmlFor="horse-microchipNumber">Chipnummer</Label>
          <Input
            id="horse-microchipNumber"
            value={formData.microchipNumber}
            onChange={(e) => setFormData({ ...formData, microchipNumber: e.target.value })}
            placeholder="T.ex. 752093100012345"
            maxLength={15}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="horse-specialNeeds">Specialbehov</Label>
        <Textarea
          id="horse-specialNeeds"
          value={formData.specialNeeds}
          onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
          placeholder="T.ex. känslig på vänster fram, allergier, medicinsk historik..."
          rows={3}
        />
      </div>

      <ResponsiveDialogFooter>
        <Button type="submit" disabled={isSaving || !formData.name.trim()}>
          {isSaving ? "Sparar..." : submitLabel}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}
