"use client"

import { Suspense, useEffect, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface FortnoxStatus {
  connected: boolean
  companyId?: string
  connectedAt?: string
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  )
}

function IntegrationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading: authLoading, isProvider } = useAuth()
  const [fortnoxStatus, setFortnoxStatus] = useState<FortnoxStatus>({
    connected: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  // Handle OAuth callback results
  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")

    if (success === "true") {
      toast.success("Fortnox kopplat!")
      setFortnoxStatus({ connected: true })
    } else if (error) {
      const errorMessages: Record<string, string> = {
        denied: "Fortnox-koppling nekades",
        state_mismatch: "Sakerhetsfel. Forsok igen.",
        token_exchange: "Kunde inte slutfora kopplingen. Forsok igen.",
        missing_params: "Ofullstandig respons fran Fortnox",
        no_provider: "Leverantorkonto hittades inte",
      }
      toast.error(errorMessages[error] || "Något gick fel")
    }
  }, [searchParams])

  useEffect(() => {
    // In a real implementation, check if Fortnox is connected via API
    // For now, we start as disconnected (MockAccountingGateway)
    setIsLoading(false)
  }, [])

  const handleConnect = () => {
    window.location.href = "/api/integrations/fortnox/connect"
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/integrations/fortnox/disconnect", {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte koppla bort")
      }

      setFortnoxStatus({ connected: false })
      toast.success("Fortnox frånkopplat")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte koppla bort"
      )
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch("/api/integrations/fortnox/sync", {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Synkning misslyckades")
      }

      const data = await response.json()
      if (data.synced > 0) {
        toast.success(`${data.synced} fakturor synkade till Fortnox`)
      } else {
        toast.info("Inga nya fakturor att synka")
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} fakturor kunde inte synkas`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Synkning misslyckades"
      )
    } finally {
      setIsSyncing(false)
    }
  }

  if (authLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-2">Integrationer</h1>
      <p className="text-gray-600 mb-8">
        Koppla externa tjanster for att automatisera fakturering och bokforing.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Fortnox</CardTitle>
              <CardDescription>
                Automatisk fakturering for genomforda bokningar
              </CardDescription>
            </div>
            <Badge variant={fortnoxStatus.connected ? "default" : "secondary"}>
              {fortnoxStatus.connected ? "Kopplad" : "Ej kopplad"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse h-20 bg-gray-100 rounded" />
          ) : fortnoxStatus.connected ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Fortnox ar kopplat. Genomforda bokningar synkas automatiskt som
                fakturor.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  variant="outline"
                >
                  {isSyncing ? "Synkar..." : "Synka fakturor manuellt"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? "Kopplar bort..." : "Koppla bort"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Koppla bort Fortnox?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tidigare synkade fakturor paverkas inte, men nya
                        bokningar kommer inte langre synkas automatiskt.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Koppla bort
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Koppla Fortnox för att automatiskt skapa fakturor när bokningar
                markeras som genomförda. Du behöver ett Fortnox-konto.
              </p>
              <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
                <li>Automatisk fakturering vid genomförd bokning</li>
                <li>Manuell synkning av missade bokningar</li>
                <li>Säkra tokenlager (krypterade)</li>
              </ul>
              <Button onClick={handleConnect}>Koppla Fortnox</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </ProviderLayout>
  )
}
