"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"

interface Horse {
  id: string
  name: string
  breed: string | null
  birthYear: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
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
}

export default function CustomerHorsesPage() {
  const router = useRouter()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [horses, setHorses] = useState<Horse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const fetchHorses = useCallback(async () => {
    try {
      const response = await fetch("/api/horses")
      if (response.ok) {
        const data = await response.json()
        setHorses(data)
      }
    } catch (error) {
      console.error("Error fetching horses:", error)
      toast.error("Kunde inte hämta hästar")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isCustomer) {
      fetchHorses()
    }
  }, [isCustomer, fetchHorses])

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
      fetchHorses()
    } catch (error) {
      console.error("Error adding horse:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till häst")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingHorse) return
    setIsSaving(true)

    try {
      const body: Record<string, unknown> = { name: formData.name }
      body.breed = formData.breed || null
      body.birthYear = formData.birthYear ? parseInt(formData.birthYear) : null
      body.color = formData.color || null
      body.gender = formData.gender || null
      body.specialNeeds = formData.specialNeeds || null

      const response = await fetch(`/api/horses/${editingHorse.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte uppdatera häst")
      }

      toast.success("Hästen har uppdaterats!")
      setEditingHorse(null)
      setFormData(emptyForm)
      fetchHorses()
    } catch (error) {
      console.error("Error updating horse:", error)
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera häst")
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
      fetchHorses()
    } catch (error) {
      console.error("Error deleting horse:", error)
      toast.error("Kunde inte ta bort häst")
    }
  }

  const openEditDialog = (horse: Horse) => {
    setEditingHorse(horse)
    setFormData({
      name: horse.name,
      breed: horse.breed || "",
      birthYear: horse.birthYear?.toString() || "",
      color: horse.color || "",
      gender: horse.gender || "",
      specialNeeds: horse.specialNeeds || "",
    })
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Mina hästar</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>Lägg till häst</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lägg till häst</DialogTitle>
              <DialogDescription>
                Fyll i information om din häst. Namn är obligatoriskt, resten är valfritt.
              </DialogDescription>
            </DialogHeader>
            <HorseForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAdd}
              isSaving={isSaving}
              submitLabel="Lägg till"
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar hästar...</p>
        </div>
      ) : horses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">
              Du har inga hästar registrerade ännu.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Lägg till dina hästar för att enkelt välja dem vid bokning
              och se deras vårdhistorik.
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              Lägg till din första häst
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {horses.map((horse) => (
            <Card key={horse.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{horse.name}</CardTitle>
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
              </CardHeader>
              <CardContent>
                {horse.specialNeeds && (
                  <p className="text-sm text-gray-600 mb-4 bg-amber-50 p-2 rounded">
                    {horse.specialNeeds}
                  </p>
                )}
                <div className="flex gap-2">
                  <Link href={`/customer/horses/${horse.id}`}>
                    <Button variant="outline" size="sm">
                      Se historik
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(horse)}
                  >
                    Redigera
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        Ta bort
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ta bort {horse.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hästen tas bort från din lista men befintliga bokningar
                          påverkas inte. Du kan lägga till hästen igen senare.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(horse)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Ta bort
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editingHorse !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingHorse(null)
            setFormData(emptyForm)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera {editingHorse?.name}</DialogTitle>
            <DialogDescription>
              Uppdatera information om din häst.
            </DialogDescription>
          </DialogHeader>
          <HorseForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEdit}
            isSaving={isSaving}
            submitLabel="Spara ändringar"
          />
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  )
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

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
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

      <DialogFooter>
        <Button type="submit" disabled={isSaving || !formData.name.trim()}>
          {isSaving ? "Sparar..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
