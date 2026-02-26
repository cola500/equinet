"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HorseSelect, type HorseOption } from "@/components/booking/HorseSelect"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

interface GroupBookingPreview {
  serviceType: string
  locationName: string
  address: string
  dateFrom: string
  dateTo: string
  maxParticipants: number
  currentParticipants: number
  joinDeadline: string | null
  notes: string | null
  status: string
}

function JoinGroupBookingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [isJoining, setIsJoining] = useState(false)

  const [formData, setFormData] = useState({
    inviteCode: searchParams.get("code") || "",
    horseId: "",
    horseName: "",
    horseInfo: "",
    notes: "",
  })

  // Preview state
  const [preview, setPreview] = useState<GroupBookingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Customer horses
  const [horses, setHorses] = useState<HorseOption[]>([])

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  // Fetch customer's horses
  useEffect(() => {
    if (authLoading || !isCustomer) return
    fetch("/api/horses")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setHorses(
            data.map((h: { id: string; name: string; breed?: string | null; specialNeeds?: string | null }) => ({
              id: h.id,
              name: h.name,
              breed: h.breed || null,
              specialNeeds: h.specialNeeds || null,
            }))
          )
        }
      })
      .catch(() => {})
  }, [authLoading, isCustomer])

  // Debounced preview fetch
  const fetchPreview = useCallback((code: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = code.trim()
    if (trimmed.length < 6) {
      setPreview(null)
      setPreviewError(null)
      return
    }

    setPreviewLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/group-bookings/preview?code=${encodeURIComponent(trimmed)}`
        )
        if (res.ok) {
          const data = await res.json()
          setPreview(data)
          setPreviewError(null)
        } else {
          const data = await res.json().catch(() => null)
          setPreview(null)
          setPreviewError(data?.error || "Kunde inte hämta information")
        }
      } catch {
        setPreview(null)
        setPreviewError("Kunde inte ansluta till servern")
      } finally {
        setPreviewLoading(false)
      }
    }, 500)
  }, [])

  // Trigger preview fetch when invite code changes
  useEffect(() => {
    fetchPreview(formData.inviteCode)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [formData.inviteCode, fetchPreview])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsJoining(true)

    try {
      const body: Record<string, unknown> = {
        inviteCode: formData.inviteCode.toUpperCase().trim(),
        numberOfHorses: 1,
      }
      if (formData.horseId) body.horseId = formData.horseId
      if (formData.horseName) body.horseName = formData.horseName
      if (formData.horseInfo) body.horseInfo = formData.horseInfo
      if (formData.notes) body.notes = formData.notes

      const response = await fetch("/api/group-bookings/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte gå med i grupprequesten")
      }

      const participant = await response.json()
      toast.success("Du har gått med i grupprequesten!")
      router.push(`/customer/group-bookings/${participant.groupBookingRequestId}`)
    } catch (error) {
      console.error("Error joining group booking:", error)
      toast.error(
        error instanceof Error ? error.message : "Kunde inte gå med"
      )
    } finally {
      setIsJoining(false)
    }
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

  const isDeadlinePassed = preview?.joinDeadline
    ? new Date(preview.joinDeadline) < new Date()
    : false
  const isClosed = preview?.status !== "open"
  const isFull = preview
    ? preview.currentParticipants >= preview.maxParticipants
    : false

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">Gå med i grupprequest</h1>
        <p className="text-gray-600 mb-8">
          Ange inbjudningskoden du fått från den som skapade grupprequesten.
        </p>

        {/* Preview card */}
        {(preview || previewLoading || previewError) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Bokningsinformation</CardTitle>
            </CardHeader>
            <CardContent>
              {previewLoading && (
                <p className="text-sm text-gray-500">Hämtar information...</p>
              )}
              {previewError && !previewLoading && (
                <p className="text-sm text-red-600">{previewError}</p>
              )}
              {preview && !previewLoading && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tjänst</span>
                    <span className="font-medium capitalize">{preview.serviceType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Plats</span>
                    <span className="font-medium">{preview.locationName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Adress</span>
                    <span className="font-medium">{preview.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Datum</span>
                    <span className="font-medium">
                      {format(new Date(preview.dateFrom), "d MMM", { locale: sv })}
                      {" - "}
                      {format(new Date(preview.dateTo), "d MMM yyyy", { locale: sv })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Deltagare</span>
                    <span className="font-medium">
                      {preview.currentParticipants} / {preview.maxParticipants}
                    </span>
                  </div>
                  {preview.joinDeadline && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deadline</span>
                      <span className={`font-medium ${isDeadlinePassed ? "text-red-600" : ""}`}>
                        {format(new Date(preview.joinDeadline), "d MMM yyyy HH:mm", { locale: sv })}
                      </span>
                    </div>
                  )}
                  {preview.notes && (
                    <div className="pt-2 border-t">
                      <span className="text-gray-500">Anteckningar: </span>
                      <span>{preview.notes}</span>
                    </div>
                  )}

                  {/* Warnings */}
                  {isClosed && (
                    <p className="text-red-600 bg-red-50 p-2 rounded text-xs font-medium mt-2">
                      Denna grupprequest är inte längre öppen för nya deltagare.
                    </p>
                  )}
                  {isDeadlinePassed && !isClosed && (
                    <p className="text-red-600 bg-red-50 p-2 rounded text-xs font-medium mt-2">
                      Deadline för att ansluta har passerat.
                    </p>
                  )}
                  {isFull && !isClosed && !isDeadlinePassed && (
                    <p className="text-amber-700 bg-amber-50 p-2 rounded text-xs font-medium mt-2">
                      Grupprequesten är fullt belagd.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Anslut</CardTitle>
            <CardDescription>
              Fyll i koden och information om din häst.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <Label htmlFor="inviteCode">Inbjudningskod *</Label>
                <Input
                  id="inviteCode"
                  value={formData.inviteCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inviteCode: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="T.ex. ABC12345"
                  maxLength={20}
                  className="font-mono text-lg tracking-wider"
                  required
                />
              </div>

              <HorseSelect
                horses={horses}
                horseId={formData.horseId}
                horseName={formData.horseName}
                horseInfo={formData.horseInfo}
                onHorseChange={({ horseId, horseName, horseInfo }) =>
                  setFormData((prev) => ({ ...prev, horseId, horseName, horseInfo }))
                }
              />

              <div>
                <Label htmlFor="notes">Anteckningar</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="T.ex. min häst är känslig på vänster fram..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isJoining}>
                  {isJoining ? "Ansluter..." : "Gå med"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/customer/group-bookings")}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  )
}

export default function JoinGroupBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      }
    >
      <JoinGroupBookingContent />
    </Suspense>
  )
}
