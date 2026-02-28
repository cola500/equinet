"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export interface SubscriptionStatus {
  status: string
  planId: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

interface SubscriptionCardProps {
  status: SubscriptionStatus | null | undefined
  isLoading: boolean
  guardMutation: (fn: () => Promise<void>) => Promise<void>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  return date.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatPlanName(planId: string): string {
  const names: Record<string, string> = {
    basic: "Basic",
    premium: "Premium",
    enterprise: "Enterprise",
  }
  return names[planId] || planId
}

export function SubscriptionCard({ status, isLoading, guardMutation }: SubscriptionCardProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  if (isLoading) {
    return (
      <Card className="mt-6" data-testid="subscription-skeleton">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </CardContent>
      </Card>
    )
  }

  const handleCheckout = async () => {
    await guardMutation(async () => {
      setIsRedirecting(true)
      try {
        const response = await fetch("/api/provider/subscription/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: "basic",
            successUrl: `${window.location.origin}/provider/profile?tab=settings&subscription=success`,
            cancelUrl: `${window.location.origin}/provider/profile?tab=settings`,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Kunde inte starta betalningen")
        }

        const { checkoutUrl } = await response.json()
        window.location.href = checkoutUrl
      } catch (error) {
        setIsRedirecting(false)
        toast.error(error instanceof Error ? error.message : "Kunde inte starta betalningen")
      }
    })
  }

  const handlePortal = async () => {
    await guardMutation(async () => {
      setIsRedirecting(true)
      try {
        const response = await fetch("/api/provider/subscription/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            returnUrl: `${window.location.origin}/provider/profile?tab=settings`,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Kunde inte öppna hanteringssidan")
        }

        const { portalUrl } = await response.json()
        window.location.href = portalUrl
      } catch (error) {
        setIsRedirecting(false)
        toast.error(error instanceof Error ? error.message : "Kunde inte öppna hanteringssidan")
      }
    })
  }

  // No subscription
  if (!status) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Prenumeration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Aktivera din prenumeration för att börja ta emot bokningar.
          </p>
          <Button onClick={handleCheckout} disabled={isRedirecting}>
            {isRedirecting ? "Omdirigerar..." : "Välj plan"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Past due
  if (status.status === "past_due") {
    return (
      <Card className="mt-6 border-amber-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Prenumeration</CardTitle>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300">
            Betalning saknas
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Det gick inte att dra pengar. Uppdatera din betalningsmetod.
          </p>
          <Button onClick={handlePortal} disabled={isRedirecting}>
            {isRedirecting ? "Omdirigerar..." : "Uppdatera betalning"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Canceling (cancelAtPeriodEnd = true)
  if (status.cancelAtPeriodEnd) {
    return (
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Prenumeration</CardTitle>
          <Badge variant="secondary">Avslutas</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Aktiv till {formatDate(status.currentPeriodEnd)}. Du kan återaktivera närsomhelst.
          </p>
          <Button onClick={handlePortal} disabled={isRedirecting}>
            {isRedirecting ? "Omdirigerar..." : "Återaktivera"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Active
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Prenumeration</CardTitle>
        <Badge className="bg-green-100 text-green-800 border-green-300">Aktiv</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 mb-4">
          <p className="text-sm text-gray-600">
            Plan: {formatPlanName(status.planId)}
          </p>
          <p className="text-sm text-gray-600">
            Förnyas: {formatDate(status.currentPeriodEnd)}
          </p>
        </div>
        <Button variant="outline" onClick={handlePortal} disabled={isRedirecting}>
          {isRedirecting ? "Omdirigerar..." : "Hantera prenumeration"}
        </Button>
      </CardContent>
    </Card>
  )
}
