"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { ProviderProfile } from "./types"

interface RescheduleSettingsCardProps {
  profile: ProviderProfile
  onSaved: () => void
  guardMutation: (fn: () => Promise<void>) => Promise<void>
}

export function RescheduleSettingsCard({ profile, onSaved, guardMutation }: RescheduleSettingsCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Ombokningsinställningar</CardTitle>
        <CardDescription>
          Bestäm om och hur kunder kan omboka sina bokningar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="reschedule-enabled" className="text-sm font-medium">
              Tillåt ombokning
            </Label>
            <p className="text-xs text-gray-500">
              Kunder kan själva omboka sina bokningar
            </p>
          </div>
          <Switch
            id="reschedule-enabled"
            checked={profile.rescheduleEnabled}
            onCheckedChange={async (checked) => {
              await guardMutation(async () => {
                try {
                  const response = await fetch("/api/provider/profile", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      businessName: profile.businessName,
                      rescheduleEnabled: checked,
                    }),
                  })
                  if (!response.ok) throw new Error("Failed to update")
                  onSaved()
                  toast.success(
                    checked
                      ? "Kunder kan nu omboka"
                      : "Ombokning är avstängt"
                  )
                } catch {
                  toast.error("Kunde inte uppdatera inställningen")
                }
              })
            }}
          />
        </div>

        {profile.rescheduleEnabled && (
          <>
            {/* Window hours */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Ombokningsfönster
              </Label>
              <p className="text-xs text-gray-500">
                Hur lång tid före bokningen kunden kan omboka
              </p>
              <Select
                value={String(profile.rescheduleWindowHours)}
                onValueChange={async (value) => {
                  await guardMutation(async () => {
                    try {
                      const response = await fetch("/api/provider/profile", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          businessName: profile.businessName,
                          rescheduleWindowHours: parseInt(value, 10),
                        }),
                      })
                      if (!response.ok) throw new Error("Failed to update")
                      onSaved()
                      toast.success("Ombokningsfönster uppdaterat")
                    } catch {
                      toast.error("Kunde inte uppdatera inställningen")
                    }
                  })
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 timmar</SelectItem>
                  <SelectItem value="24">24 timmar</SelectItem>
                  <SelectItem value="48">48 timmar</SelectItem>
                  <SelectItem value="72">72 timmar</SelectItem>
                  <SelectItem value="168">1 vecka</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max reschedules */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Max antal ombokningar
              </Label>
              <p className="text-xs text-gray-500">
                Hur många gånger en kund kan omboka samma bokning
              </p>
              <Select
                value={String(profile.maxReschedules)}
                onValueChange={async (value) => {
                  await guardMutation(async () => {
                    try {
                      const response = await fetch("/api/provider/profile", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          businessName: profile.businessName,
                          maxReschedules: parseInt(value, 10),
                        }),
                      })
                      if (!response.ok) throw new Error("Failed to update")
                      onSaved()
                      toast.success("Max ombokningar uppdaterat")
                    } catch {
                      toast.error("Kunde inte uppdatera inställningen")
                    }
                  })
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 gång</SelectItem>
                  <SelectItem value="2">2 gånger</SelectItem>
                  <SelectItem value="3">3 gånger</SelectItem>
                  <SelectItem value="5">5 gånger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Requires approval */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="reschedule-approval" className="text-sm font-medium">
                  Kräv godkännande
                </Label>
                <p className="text-xs text-gray-500">
                  Du måste godkänna ombokningar innan de bekräftas
                </p>
              </div>
              <Switch
                id="reschedule-approval"
                checked={profile.rescheduleRequiresApproval}
                onCheckedChange={async (checked) => {
                  await guardMutation(async () => {
                    try {
                      const response = await fetch("/api/provider/profile", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          businessName: profile.businessName,
                          rescheduleRequiresApproval: checked,
                        }),
                      })
                      if (!response.ok) throw new Error("Failed to update")
                      onSaved()
                      toast.success(
                        checked
                          ? "Godkännande krävs nu för ombokningar"
                          : "Ombokningar bekräftas direkt"
                      )
                    } catch {
                      toast.error("Kunde inte uppdatera inställningen")
                    }
                  })
                }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
