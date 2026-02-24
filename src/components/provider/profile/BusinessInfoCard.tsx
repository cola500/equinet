"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { ProviderProfile } from "./types"

interface BusinessInfoCardProps {
  profile: ProviderProfile
  onSaved: () => void
  guardMutation: (fn: () => Promise<void>) => Promise<void>
}

export function BusinessInfoCard({ profile, onSaved, guardMutation }: BusinessInfoCardProps) {
  const [isEditingBusiness, setIsEditingBusiness] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  const [businessData, setBusinessData] = useState({
    businessName: "",
    description: "",
    address: "",
    city: "",
    postalCode: "",
    serviceArea: "",
    latitude: null as number | null,
    longitude: null as number | null,
    serviceAreaKm: null as number | null,
  })

  // Sync form state when profile data arrives or changes
  useEffect(() => {
    if (profile) {
      setBusinessData({
        businessName: profile.businessName,
        description: profile.description || "",
        address: profile.address || "",
        city: profile.city || "",
        postalCode: profile.postalCode || "",
        serviceArea: profile.serviceArea || "",
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
        serviceAreaKm: profile.serviceAreaKm ?? null,
      })
    }
  }, [profile])

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await guardMutation(async () => {
      try {
        const response = await fetch("/api/provider/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessName: businessData.businessName,
            description: businessData.description || undefined,
            address: businessData.address || undefined,
            city: businessData.city || undefined,
            postalCode: businessData.postalCode || undefined,
            serviceArea: businessData.serviceArea || undefined,
            latitude: businessData.latitude,
            longitude: businessData.longitude,
            serviceAreaKm: businessData.serviceAreaKm,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update business profile")
        }

        setIsEditingBusiness(false)
        toast.success("Företagsinformation uppdaterad!")
        onSaved()
      } catch (error) {
        console.error("Error updating business profile:", error)
        toast.error("Kunde inte uppdatera företagsinformation")
      }
    })
  }

  const handleBusinessCancel = () => {
    if (profile) {
      setBusinessData({
        businessName: profile.businessName,
        description: profile.description || "",
        address: profile.address || "",
        city: profile.city || "",
        postalCode: profile.postalCode || "",
        serviceArea: profile.serviceArea || "",
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
        serviceAreaKm: profile.serviceAreaKm ?? null,
      })
    }
    setIsEditingBusiness(false)
  }

  const handleGeocode = async () => {
    if (!businessData.address && !businessData.city) {
      toast.error("Ange adress eller stad för att hitta koordinater")
      return
    }

    setIsGeocoding(true)
    try {
      const params = new URLSearchParams()
      if (businessData.address) params.append("address", businessData.address)
      if (businessData.city) params.append("city", businessData.city)

      const response = await fetch(`/api/geocode?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Kunde inte hitta platsen")
      }

      const { latitude, longitude } = await response.json()
      setBusinessData(prev => ({ ...prev, latitude, longitude }))
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
        setBusinessData(prev => ({
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Företagsinformation</CardTitle>
        <CardDescription>
          Information om ditt företag som visas för kunder
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isEditingBusiness ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Företagsnamn</Label>
              <p className="font-medium">{profile.businessName}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Beskrivning</Label>
              <p className="font-medium">{profile.description || "Ej angiven"}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Adress</Label>
              <p className="font-medium">{profile.address || "Ej angiven"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Stad</Label>
                <p className="font-medium">{profile.city || "Ej angiven"}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Postnummer</Label>
                <p className="font-medium">{profile.postalCode || "Ej angiven"}</p>
              </div>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Serviceområde</Label>
              <p className="font-medium">{profile.serviceArea || "Ej angiven"}</p>
            </div>
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm text-gray-600">Hem-position</Label>
              <p className="text-xs text-gray-500 mb-2">
                Används för ruttplanering och avståndsmatchning
              </p>
              {profile.latitude && profile.longitude ? (
                <p className="font-medium text-green-600">
                  Plats sparad ({profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)})
                </p>
              ) : (
                <p className="font-medium text-amber-600">
                  Ej angiven - klicka Redigera för att sätta din position
                </p>
              )}
            </div>
            <div className="pt-4">
              <Button onClick={() => setIsEditingBusiness(true)}>
                Redigera
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBusinessSubmit} className="space-y-4">
            <div>
              <Label htmlFor="businessName">Företagsnamn *</Label>
              <Input
                id="businessName"
                value={businessData.businessName}
                onChange={(e) =>
                  setBusinessData({ ...businessData, businessName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Beskrivning</Label>
              <Textarea
                id="description"
                value={businessData.description}
                onChange={(e) =>
                  setBusinessData({ ...businessData, description: e.target.value })
                }
                rows={3}
                placeholder="Berätta om ditt företag och dina tjänster..."
              />
            </div>
            <div>
              <Label htmlFor="address">Adress</Label>
              <Input
                id="address"
                value={businessData.address}
                onChange={(e) =>
                  setBusinessData({ ...businessData, address: e.target.value })
                }
                placeholder="Exempelvis: Storgatan 1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  value={businessData.city}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, city: e.target.value })
                  }
                  placeholder="Exempelvis: Stockholm"
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postnummer</Label>
                <Input
                  id="postalCode"
                  value={businessData.postalCode}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, postalCode: e.target.value })
                  }
                  placeholder="123 45"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="serviceArea">Serviceområde</Label>
              <Input
                id="serviceArea"
                value={businessData.serviceArea}
                onChange={(e) =>
                  setBusinessData({ ...businessData, serviceArea: e.target.value })
                }
                placeholder="Exempelvis: Stockholm och Södermanlands län"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium">Hem-position</Label>
              <p className="text-xs text-gray-500 mb-3">
                Ange din startposition för ruttplanering
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleGeocode}
                disabled={isGeocoding || (!businessData.address && !businessData.city)}
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

            {businessData.latitude && businessData.longitude && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                Plats sparad: {businessData.latitude.toFixed(4)}, {businessData.longitude.toFixed(4)}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit">Spara ändringar</Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleBusinessCancel}
              >
                Avbryt
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
