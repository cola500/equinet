"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { AvailabilitySchedule } from "@/components/provider/AvailabilitySchedule"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { ImageUpload } from "@/components/ui/image-upload"

interface ProviderProfile {
  id: string
  businessName: string
  description?: string
  address?: string
  city?: string
  postalCode?: string
  serviceArea?: string
  latitude?: number | null
  longitude?: number | null
  serviceAreaKm?: number | null
  profileImageUrl?: string | null
  user: {
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
}

export default function ProviderProfilePage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [isEditingBusiness, setIsEditingBusiness] = useState(false)

  const [personalData, setPersonalData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  })

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
  const [isGeocoding, setIsGeocoding] = useState(false)

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchProfile()
    }
  }, [isProvider])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/provider/profile")
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        setPersonalData({
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          phone: data.user.phone || "",
        })
        setBusinessData({
          businessName: data.businessName,
          description: data.description || "",
          address: data.address || "",
          city: data.city || "",
          postalCode: data.postalCode || "",
          serviceArea: data.serviceArea || "",
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          serviceAreaKm: data.serviceAreaKm ?? null,
        })
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast.error("Kunde inte hämta profil")
    }
  }

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: personalData.firstName,
          lastName: personalData.lastName,
          phone: personalData.phone || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update personal profile")
      }

      setIsEditingPersonal(false)
      toast.success("Personlig information uppdaterad!")
      fetchProfile()
    } catch (error) {
      console.error("Error updating personal profile:", error)
      toast.error("Kunde inte uppdatera personlig information")
    }
  }

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
      fetchProfile()
    } catch (error) {
      console.error("Error updating business profile:", error)
      toast.error("Kunde inte uppdatera företagsinformation")
    }
  }

  const handlePersonalCancel = () => {
    if (profile) {
      setPersonalData({
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        phone: profile.user.phone || "",
      })
    }
    setIsEditingPersonal(false)
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

  // Calculate profile completion
  const calculateProfileCompletion = () => {
    if (!profile) return 0
    const fields = [
      profile.user.firstName,
      profile.user.lastName,
      profile.user.phone,
      profile.businessName,
      profile.description,
      profile.address,
      profile.city,
      profile.postalCode,
      profile.serviceArea,
    ]
    const filledFields = fields.filter(field => field && field.length > 0).length
    // Location counts as one field (both lat/lng needed)
    const hasLocation = profile.latitude != null && profile.longitude != null
    const totalFields = fields.length + 1 // +1 for location
    const filledTotal = filledFields + (hasLocation ? 1 : 0)
    return Math.round((filledTotal / totalFields) * 100)
  }

  if (isLoading || !isProvider || !profile) {
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
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-8">Min profil</h1>

          {/* Profile Completion Indicator */}
          {calculateProfileCompletion() < 100 && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-amber-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">
                      Profil {calculateProfileCompletion()}% komplett
                    </h3>
                    <p className="text-sm text-amber-800 mb-3">
                      En komplett profil gör att kunder lättare hittar och litar på dig.
                      Fyll i alla fält nedan för att synas bättre i sökresultaten.
                    </p>
                    <div className="w-full bg-amber-200 rounded-full h-2">
                      <div
                        className="bg-amber-600 h-2 rounded-full transition-all"
                        style={{ width: `${calculateProfileCompletion()}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile Image */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Profilbild</CardTitle>
              <CardDescription>
                Ladda upp en profilbild som visas för kunder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageUpload
                bucket="avatars"
                entityId={profile.id}
                currentUrl={profile.profileImageUrl}
                onUploaded={(url) => setProfile({ ...profile, profileImageUrl: url })}
                variant="circle"
                className="w-32"
              />
            </CardContent>
          </Card>

          {/* Personal Information Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Personlig information</CardTitle>
              <CardDescription>
                Din kontaktinformation och inloggningsuppgifter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isEditingPersonal ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-600">E-post</Label>
                    <p className="font-medium">{profile.user.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Förnamn</Label>
                      <p className="font-medium">{profile.user.firstName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Efternamn</Label>
                      <p className="font-medium">{profile.user.lastName}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Telefon</Label>
                    <p className="font-medium">{profile.user.phone || "Ej angiven"}</p>
                  </div>
                  <div className="pt-4">
                    <Button onClick={() => setIsEditingPersonal(true)}>
                      Redigera
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePersonalSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-sm text-gray-600">
                      E-post
                    </Label>
                    <Input
                      id="email"
                      value={profile.user.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      E-postadressen kan inte ändras
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Förnamn *</Label>
                      <Input
                        id="firstName"
                        value={personalData.firstName}
                        onChange={(e) =>
                          setPersonalData({ ...personalData, firstName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Efternamn *</Label>
                      <Input
                        id="lastName"
                        value={personalData.lastName}
                        onChange={(e) =>
                          setPersonalData({ ...personalData, lastName: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={personalData.phone}
                      onChange={(e) =>
                        setPersonalData({ ...personalData, phone: e.target.value })
                      }
                      placeholder="070-123 45 67"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit">Spara ändringar</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePersonalCancel}
                    >
                      Avbryt
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Business Information Card */}
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
                  <div className="grid grid-cols-2 gap-4">
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

                  <div className="flex gap-2">
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

      {/* Availability Schedule Card */}
      {profile && <AvailabilitySchedule providerId={profile.id} />}
    </ProviderLayout>
  )
}
