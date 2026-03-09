"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

interface Spot {
  id: string
  label: string | null
  status: string
  pricePerMonth: number | null
  notes: string | null
}

export default function StableSpotsPage() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [counts, setCounts] = useState({ total: 0, available: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [newLabel, setNewLabel] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const fetchSpots = useCallback(async () => {
    try {
      const res = await fetch("/api/stable/spots")
      if (res.ok) {
        const data = await res.json()
        setSpots(data.spots)
        setCounts(data._count)
      }
    } catch {
      toast.error("Kunde inte hamta stallplatser")
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

  const handleDelete = async (spotId: string) => {
    if (!confirm("Ar du saker pa att du vill ta bort denna stallplats?")) return

    try {
      const res = await fetch(`/api/stable/spots/${spotId}`, {
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
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
        <h2 className="font-semibold mb-3">Lagg till stallplats</h2>
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
            <Label htmlFor="spotPrice">Pris/man</Label>
            <Input
              id="spotPrice"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="kr"
            />
          </div>
          <Button onClick={handleCreate} disabled={isCreating} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            {isCreating ? "Skapar..." : "Lagg till"}
          </Button>
        </div>
      </div>

      {/* Spots list */}
      {spots.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Inga stallplatser registrerade an. Lagg till din forsta stallplats ovan.
        </p>
      ) : (
        <div className="space-y-3">
          {spots.map((spot) => (
            <div
              key={spot.id}
              className="bg-white rounded-lg border p-4 flex items-center justify-between"
            >
              <div>
                <span className="font-medium">
                  {spot.label || "Stallplats"}
                </span>
                {spot.pricePerMonth && (
                  <span className="ml-2 text-sm text-gray-500">
                    {spot.pricePerMonth} kr/man
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={spot.status === "available" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggleStatus(spot)}
                >
                  {spot.status === "available" ? "Ledig" : "Uthyrd"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(spot.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
