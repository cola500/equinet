"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"

interface Profile {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  userType: string
  city?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
}

export default function CustomerProfilePage() {
  const router = useRouter()
  const { isLoading, isCustomer } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    city: "",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
  })
  const [isGeocoding, setIsGeocoding] = useState(false)

  useEffect(() => {
    if (!isLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, isLoading, router])

  useEffect(() => {
    if (isCustomer) {
      fetchProfile()
    }
  }, [isCustomer])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile")
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        setFormData({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || "",
          city: data.city || "",
          address: data.address || "",
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        })
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast.error("Kunde inte hämta profil")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || undefined,
          city: formData.city || undefined,
          address: formData.address || undefined,
          latitude: formData.latitude,
          longitude: formData.longitude,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      setIsEditing(false)
      toast.success("Profil uppdaterad!")
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("Kunde inte uppdatera profil")
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || "",
        city: profile.city || "",
        address: profile.address || "",
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
      })
    }
    setIsEditing(false)
  }

  const handleGeocode = async () => {
    if (!formData.address && !formData.city) {
      toast.error("Ange adress eller ort för att hitta koordinater")
      return
    }

    setIsGeocoding(true)
    try {
      const params = new URLSearchParams()
      if (formData.address) params.append("address", formData.address)
      if (formData.city) params.append("city", formData.city)

      const response = await fetch(`/api/geocode?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Kunde inte hitta platsen")
      }

      const { latitude, longitude } = await response.json()
      setFormData(prev => ({ ...prev, latitude, longitude }))
      toast.success("Plats hittad!")
    } catch (error) {
      console.error("Geocoding error:", error)
      toast.error("Kunde inte hitta platsen. Kontrollera adressen.")
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Din webbläsare stöder inte platsdelning")
      return
    }

    setIsGeocoding(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
        setIsGeocoding(false)
        toast.success("Din position har sparats!")
      },
      (error) => {
        console.error("Geolocation error:", error)
        setIsGeocoding(false)
        toast.error("Kunde inte hämta din position. Kontrollera behörigheter.")
      }
    )
  }

  if (isLoading || !isCustomer || !profile) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout>
      <h1 className="text-3xl font-bold mb-8">Min profil</h1>
      <div className="max-w-2xl">
        <Card>
            <CardHeader>
              <CardTitle>Profilinformation</CardTitle>
              <CardDescription>
                Hantera din personliga information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-600">E-post</Label>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Förnamn</Label>
                    <p className="font-medium">{profile.firstName}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Efternamn</Label>
                    <p className="font-medium">{profile.lastName}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Telefon</Label>
                    <p className="font-medium">{profile.phone || "Ej angiven"}</p>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm text-gray-600">Min plats</Label>
                    <p className="text-xs text-gray-500 mb-2">
                      Används för att matcha dig med leverantörer i ditt område
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Adress</Label>
                    <p className="font-medium">{profile.address || "Ej angiven"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Ort</Label>
                    <p className="font-medium">{profile.city || "Ej angiven"}</p>
                  </div>
                  {profile.latitude && profile.longitude && (
                    <div>
                      <Label className="text-sm text-gray-600">Koordinater</Label>
                      <p className="font-medium text-green-600">
                        Plats sparad ({profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)})
                      </p>
                    </div>
                  )}
                  <div className="pt-4">
                    <Button onClick={() => setIsEditing(true)}>
                      Redigera profil
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-sm text-gray-600">
                      E-post
                    </Label>
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      E-postadressen kan inte ändras
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="firstName">Förnamn *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Efternamn *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="070-123 45 67"
                    />
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <Label className="text-sm font-medium">Min plats</Label>
                    <p className="text-xs text-gray-500 mb-3">
                      Ange din adress för att hitta leverantörer nära dig
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="address">Adress</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Storgatan 1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="city">Ort</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="Göteborg"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeocode}
                      disabled={isGeocoding || (!formData.address && !formData.city)}
                    >
                      {isGeocoding ? "Söker..." : "Sök adress"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUseCurrentLocation}
                      disabled={isGeocoding}
                    >
                      Använd min position
                    </Button>
                  </div>

                  {formData.latitude && formData.longitude && (
                    <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                      Plats sparad: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button type="submit">Spara ändringar</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Avbryt
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
    </CustomerLayout>
  )
}
