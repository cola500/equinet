"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface StableProfile {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  municipality: string | null
  contactEmail: string | null
  contactPhone: string | null
}

export default function StableProfilePage() {
  const { isStableOwner } = useAuth()
  const { update: updateSession } = useSession()
  const [profile, setProfile] = useState<StableProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [municipality, setMunicipality] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/stable/profile")
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
          setName(data.name || "")
          setDescription(data.description || "")
          setAddress(data.address || "")
          setCity(data.city || "")
          setPostalCode(data.postalCode || "")
          setMunicipality(data.municipality || "")
          setContactEmail(data.contactEmail || "")
          setContactPhone(data.contactPhone || "")
        }
      } catch {
        // No profile yet
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/stable/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          address: address || undefined,
          city: city || undefined,
          postalCode: postalCode || undefined,
          municipality: municipality || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Kunde inte skapa stallprofil")
        return
      }

      const data = await res.json()
      setProfile(data)
      // Refresh session to include stableId
      await updateSession()
      toast.success("Stallprofil skapad!")
    } catch {
      toast.error("Kunde inte skapa stallprofil")
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch("/api/stable/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          address: address || undefined,
          city: city || undefined,
          postalCode: postalCode || undefined,
          municipality: municipality || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Kunde inte uppdatera stallprofil")
        return
      }

      const data = await res.json()
      setProfile(data)
      toast.success("Stallprofil uppdaterad!")
    } catch {
      toast.error("Kunde inte uppdatera stallprofil")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const isEdit = !!profile

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? "Redigera stallprofil" : "Skapa stallprofil"}
      </h1>

      <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Stallnamn *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Solangens Stall"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Beskrivning</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskriv ditt stall..."
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="municipality">Kommun</Label>
            <Input
              id="municipality"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="T.ex. Alingsas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Stad</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="T.ex. Sollebrunn"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address">Adress</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Stallvagen 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postnummer</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="44192"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Kontakt-email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="stall@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Kontakttelefon</Label>
            <Input
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="070-123 45 67"
            />
          </div>
        </div>

        <Button type="submit" disabled={isSaving || isCreating || !name}>
          {isEdit
            ? isSaving ? "Sparar..." : "Spara andringar"
            : isCreating ? "Skapar..." : "Skapa stallprofil"
          }
        </Button>
      </form>
    </div>
  )
}
