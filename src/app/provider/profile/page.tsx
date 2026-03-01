"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useProviderProfile } from "@/hooks/useProviderProfile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AvailabilitySchedule } from "@/components/provider/AvailabilitySchedule"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { ImageUpload } from "@/components/ui/image-upload"
import { InfoPopover } from "@/components/ui/info-popover"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { ProfileSkeleton } from "@/components/loading/ProfileSkeleton"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { BusinessInfoCard } from "@/components/provider/profile/BusinessInfoCard"
import { RescheduleSettingsCard } from "@/components/provider/profile/RescheduleSettingsCard"
import { RecurringBookingsCard } from "@/components/provider/profile/RecurringBookingsCard"
import { SubscriptionCard } from "@/components/provider/profile/SubscriptionCard"
import type { SubscriptionStatus } from "@/components/provider/profile/SubscriptionCard"
import type { ProviderProfile } from "@/components/provider/profile/types"
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog"

export default function ProviderProfilePage() {
  const { isLoading, isProvider, providerId } = useAuth()
  const { profile: swrProfile, mutate: mutateProfile } = useProviderProfile()
  const profile = swrProfile as ProviderProfile | null
  const [activeTab, setActiveTab] = useState<"profile" | "availability" | "settings">("profile")
  const [isEditingPersonal, setIsEditingPersonal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [personalData, setPersonalData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  })

  const { guardMutation } = useOfflineGuard()
  const selfRescheduleEnabled = useFeatureFlag("self_reschedule")
  const recurringBookingsEnabled = useFeatureFlag("recurring_bookings")
  const subscriptionEnabled = useFeatureFlag("provider_subscription")

  // Subscription status (only fetched when flag is on)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  useEffect(() => {
    if (!subscriptionEnabled || !isProvider) return
    setSubscriptionLoading(true)
    fetch("/api/provider/subscription/status")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setSubscriptionStatus(data))
      .catch(() => setSubscriptionStatus(null))
      .finally(() => setSubscriptionLoading(false))
  }, [subscriptionEnabled, isProvider])

  // Sync form state when SWR profile data arrives or changes
  useEffect(() => {
    if (profile) {
      setPersonalData({
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        phone: profile.user.phone || "",
      })
    }
  }, [profile])

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await guardMutation(async () => {
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
        mutateProfile()
      } catch (error) {
        console.error("Error updating personal profile:", error)
        toast.error("Kunde inte uppdatera personlig information")
      }
    })
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
      <ProviderLayout>
        <ProfileSkeleton />
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-6">Min profil</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b">
        {([
          { key: "profile" as const, label: "Profil" },
          { key: "settings" as const, label: "Inställningar" },
          { key: "availability" as const, label: "Tillgänglighet" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Profil */}
      {activeTab === "profile" && (
        <>
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
                onUploaded={() => mutateProfile()}
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
          <BusinessInfoCard
            profile={profile}
            onSaved={() => mutateProfile()}
            guardMutation={guardMutation}
          />

          {/* Verification Link */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Verifiering</CardTitle>
              <CardDescription>
                Verifiera ditt företag för att öka förtroendet hos kunder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/provider/verification">
                <Button variant="outline">Gå till verifiering</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Export Data */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Exportera data</CardTitle>
              <CardDescription>
                Ladda ner all din data i enlighet med GDPR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/provider/export">
                <Button variant="outline">Exportera mina data</Button>
              </Link>
            </CardContent>
          </Card>

        </>
      )}

      {/* Tab: Inställningar */}
      {activeTab === "settings" && (
        <>
      {/* Subscription Card */}
      {subscriptionEnabled && (
        <SubscriptionCard
          status={subscriptionStatus}
          isLoading={subscriptionLoading}
          guardMutation={guardMutation}
        />
      )}

      {/* Booking Settings Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="accepting-new-customers" className="text-sm font-medium flex items-center gap-1.5">
                Ta emot nya kunder
                <InfoPopover text="När avaktiverad kan bara kunder som redan har genomförda bokningar hos dig boka nya tider" helpHref="/provider/help/stang-for-nya-kunder" />
              </Label>
              <p className="text-xs text-gray-500">
                {profile.acceptingNewCustomers
                  ? "Alla kunder kan boka dina tjänster"
                  : "Bara befintliga kunder kan boka"}
              </p>
            </div>
            <Switch
              id="accepting-new-customers"
              checked={profile.acceptingNewCustomers}
              onCheckedChange={async (checked) => {
                await guardMutation(async () => {
                  try {
                    const response = await fetch("/api/provider/profile", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        businessName: profile.businessName,
                        acceptingNewCustomers: checked,
                      }),
                    })
                    if (!response.ok) throw new Error("Failed to update")
                    mutateProfile()
                    toast.success(
                      checked
                        ? "Du tar nu emot nya kunder"
                        : "Du tar nu bara emot befintliga kunder"
                    )
                  } catch {
                    toast.error("Kunde inte uppdatera inställningen")
                  }
                })
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reschedule Settings Card */}
      {selfRescheduleEnabled && (
        <RescheduleSettingsCard
          profile={profile}
          onSaved={() => mutateProfile()}
          guardMutation={guardMutation}
        />
      )}

      {/* Recurring Booking Settings Card */}
      {recurringBookingsEnabled && (
        <RecurringBookingsCard
          profile={profile}
          onSaved={() => mutateProfile()}
          guardMutation={guardMutation}
        />
      )}

      {/* Delete Account */}
      <Card className="border-red-200 mt-6">
        <CardHeader>
          <CardTitle className="text-red-600">Radera konto</CardTitle>
          <CardDescription>
            Permanent radering av ditt konto och all personlig data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Radera mitt konto
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />

        </>
      )}

      {/* Tab: Tillgänglighet */}
      {activeTab === "availability" && (
        <>
          {providerId && <AvailabilitySchedule providerId={providerId} />}
        </>
      )}
    </ProviderLayout>
  )
}
