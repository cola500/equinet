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

interface RecurringBookingsCardProps {
  profile: ProviderProfile
  onSaved: () => void
  guardMutation: (fn: () => Promise<void>) => Promise<void>
}

export function RecurringBookingsCard({ profile, onSaved, guardMutation }: RecurringBookingsCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Återkommande bokningar</CardTitle>
        <CardDescription>
          Tillåt kunder att skapa återkommande bokningsserier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="recurring-enabled" className="text-sm font-medium">
              Tillåt återkommande bokningar
            </Label>
            <p className="text-xs text-gray-500">
              Kunder kan boka samma tjänst med regelbundna intervall
            </p>
          </div>
          <Switch
            id="recurring-enabled"
            checked={profile.recurringEnabled}
            onCheckedChange={async (checked) => {
              await guardMutation(async () => {
                try {
                  const response = await fetch("/api/provider/profile", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      businessName: profile.businessName,
                      recurringEnabled: checked,
                    }),
                  })
                  if (!response.ok) throw new Error("Failed to update")
                  onSaved()
                  toast.success(
                    checked
                      ? "Återkommande bokningar aktiverade"
                      : "Återkommande bokningar avaktiverade"
                  )
                } catch {
                  toast.error("Kunde inte uppdatera inställningen")
                }
              })
            }}
          />
        </div>

        {profile.recurringEnabled && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Max antal tillfällen per serie
            </Label>
            <p className="text-xs text-gray-500">
              Högsta antal bokningar en kund kan skapa i en serie
            </p>
            <Select
              value={String(profile.maxSeriesOccurrences)}
              onValueChange={async (value) => {
                await guardMutation(async () => {
                  try {
                    const response = await fetch("/api/provider/profile", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        businessName: profile.businessName,
                        maxSeriesOccurrences: parseInt(value, 10),
                      }),
                    })
                    if (!response.ok) throw new Error("Failed to update")
                    onSaved()
                    toast.success("Max tillfällen uppdaterat")
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
                <SelectItem value="4">4 tillfällen</SelectItem>
                <SelectItem value="6">6 tillfällen</SelectItem>
                <SelectItem value="8">8 tillfällen</SelectItem>
                <SelectItem value="12">12 tillfällen</SelectItem>
                <SelectItem value="24">24 tillfällen</SelectItem>
                <SelectItem value="52">52 tillfällen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
