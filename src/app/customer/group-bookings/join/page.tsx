"use client"

import { useState, useEffect, Suspense } from "react"
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

function JoinGroupBookingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading: authLoading, isCustomer } = useAuth()
  const [isJoining, setIsJoining] = useState(false)

  const [formData, setFormData] = useState({
    inviteCode: searchParams.get("code") || "",
    numberOfHorses: "1",
    horseName: "",
    notes: "",
  })

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsJoining(true)

    try {
      const body = {
        inviteCode: formData.inviteCode.toUpperCase().trim(),
        numberOfHorses: parseInt(formData.numberOfHorses),
        ...(formData.horseName && { horseName: formData.horseName }),
        ...(formData.notes && { notes: formData.notes }),
      }

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

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">Gå med i grupprequest</h1>
        <p className="text-gray-600 mb-8">
          Ange inbjudningskoden du fått från den som skapade grupprequesten.
        </p>

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

              <div>
                <Label htmlFor="numberOfHorses">Antal hästar</Label>
                <Input
                  id="numberOfHorses"
                  type="number"
                  value={formData.numberOfHorses}
                  onChange={(e) =>
                    setFormData({ ...formData, numberOfHorses: e.target.value })
                  }
                  min={1}
                  max={10}
                />
              </div>

              <div>
                <Label htmlFor="horseName">Hästnamn</Label>
                <Input
                  id="horseName"
                  value={formData.horseName}
                  onChange={(e) =>
                    setFormData({ ...formData, horseName: e.target.value })
                  }
                  placeholder="T.ex. Blansen"
                />
              </div>

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
