"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
} from "@/components/ui/responsive-alert-dialog"

interface Spot {
  id: string
  label: string | null
  status: string
  pricePerMonth: number | null
  notes: string | null
}

export default function StableSpotsPage() {
  const { isStableOwner, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [spots, setSpots] = useState<Spot[]>([])
  const [counts, setCounts] = useState({ total: 0, available: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [newLabel, setNewLabel] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const listEndRef = useRef<HTMLDivElement>(null)

  // Redirect guard: require stable profile
  useEffect(() => {
    if (!authLoading && !isStableOwner) {
      toast.error("Skapa en stallprofil först")
      router.replace("/stable/profile")
    }
  }, [authLoading, isStableOwner, router])

  const fetchSpots = useCallback(async () => {
    try {
      const res = await fetch("/api/stable/spots")
      if (res.ok) {
        const data = await res.json()
        setSpots(data.spots)
        setCounts(data._count)
      }
    } catch {
      toast.error("Kunde inte hämta stallplatser")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSpots()
  }, [fetchSpots])

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const res = await fetch("/api/stable/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel || undefined,
          pricePerMonth: newPrice ? parseFloat(newPrice) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Kunde inte skapa stallplats")
        return
      }
      setNewLabel("")
      setNewPrice("")
      await fetchSpots()
      toast.success("Stallplats skapad!")
      // Scroll to newly added spot
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    } catch {
      toast.error("Kunde inte skapa stallplats")
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleStatus = async (spot: Spot) => {
    const newStatus = spot.status === "available" ? "rented" : "available"
    try {
      const res = await fetch(`/api/stable/spots/${spot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await fetchSpots()
      } else {
        toast.error("Kunde inte uppdatera status")
      }
    } catch {
      toast.error("Kunde inte uppdatera status")
    }
  }

  const handleStartEdit = (spot: Spot) => {
    setEditingSpotId(spot.id)
    setEditLabel(spot.label || "")
    setEditPrice(spot.pricePerMonth != null ? String(spot.pricePerMonth) : "")
  }

  const handleCancelEdit = () => {
    setEditingSpotId(null)
    setEditLabel("")
    setEditPrice("")
  }

  const handleSaveEdit = async (spotId: string) => {
    try {
      const res = await fetch(`/api/stable/spots/${spotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel || undefined,
          pricePerMonth: editPrice ? parseFloat(editPrice) : undefined,
        }),
      })
      if (res.ok) {
        await fetchSpots()
        handleCancelEdit()
        toast.success("Stallplats uppdaterad")
      } else {
        toast.error("Kunde inte uppdatera stallplats")
      }
    } catch {
      toast.error("Kunde inte uppdatera stallplats")
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/stable/spots/${deleteTarget}`, {
        method: "DELETE",
      })
      if (res.ok) {
        await fetchSpots()
        toast.success("Stallplats borttagen")
      } else {
        toast.error("Kunde inte ta bort stallplats")
      }
    } catch {
      toast.error("Kunde inte ta bort stallplats")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="Laddar..." />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stallplatser</h1>
          <p className="text-sm text-gray-500">
            {counts.available} av {counts.total} lediga
          </p>
        </div>
      </div>

      {/* Create new spot */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h2 className="font-semibold mb-3">Lägg till stallplats</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label htmlFor="spotLabel">Namn/etikett</Label>
            <Input
              id="spotLabel"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder='T.ex. "Box 3" eller "Spilta A"'
            />
          </div>
          <div className="w-32">
            <Label htmlFor="spotPrice">Pris/mån</Label>
            <Input
              id="spotPrice"
              type="text"
              inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="kr"
            />
          </div>
          <Button onClick={handleCreate} disabled={isCreating} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            {isCreating ? "Skapar..." : "Lägg till"}
          </Button>
        </div>
      </div>

      {/* Spots list */}
      {spots.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Inga stallplatser registrerade än. Lägg till din första stallplats ovan.
        </p>
      ) : (
        <div className="space-y-3">
          {spots.map((spot) => (
            <div
              key={spot.id}
              className="bg-white rounded-lg border p-4"
            >
              {editingSpotId === spot.id ? (
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label htmlFor={`edit-label-${spot.id}`}>Namn</Label>
                    <Input
                      id={`edit-label-${spot.id}`}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Namn/etikett"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`edit-price-${spot.id}`}>Pris/mån</Label>
                    <Input
                      id={`edit-price-${spot.id}`}
                      type="text"
                      inputMode="decimal"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="kr"
                    />
                  </div>
                  <Button size="sm" onClick={() => handleSaveEdit(spot.id)} className="shrink-0">
                    <Check className="h-4 w-4 mr-1" />
                    Spara
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {spot.label || "Stallplats"}
                    </span>
                    {spot.pricePerMonth != null && (
                      <span className="ml-2 text-sm text-gray-500">
                        {spot.pricePerMonth.toLocaleString("sv-SE")} kr/mån
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      spot.status === "available"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {spot.status === "available" ? "Ledig" : "Uthyrd"}
                    </span>
                    <Button
                      variant={spot.status === "available" ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(spot)}
                    >
                      {spot.status === "available" ? "Markera uthyrd" : "Markera ledig"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Redigera ${spot.label || "stallplats"}`}
                      onClick={() => handleStartEdit(spot)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Ta bort ${spot.label || "stallplats"}`}
                      onClick={() => setDeleteTarget(spot.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={listEndRef} />
        </div>
      )}
      {/* Delete confirmation dialog */}
      <ResponsiveAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>Ta bort stallplats</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              Är du säker på att du vill ta bort denna stallplats? Åtgärden kan inte ångras.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Avbryt
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Tar bort..." : "Ta bort"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </div>
  )
}
