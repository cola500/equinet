"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ShareProfileDialogProps {
  horseId: string
  horseName: string
}

export function ShareProfileDialog({
  horseId,
  horseName,
}: ShareProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [profileUrl, setProfileUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const handleCreateProfile = async () => {
    setIsCreating(true)
    try {
      const response = await fetch(`/api/horses/${horseId}/profile`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa delbar länk")
      }

      const data = await response.json()
      setProfileUrl(data.url)
      setExpiresAt(data.expiresAt)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skapa delbar länk"
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!profileUrl) return
    try {
      await navigator.clipboard.writeText(profileUrl)
      toast.success("Länken kopierad!")
    } catch {
      // Fallback for browsers without clipboard API
      toast.error("Kunde inte kopiera. Markera länken och kopiera manuellt.")
    }
  }

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when closing
      setProfileUrl(null)
      setExpiresAt(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => setOpen(true)}>
        Dela hästprofil
      </Button>
      <ResponsiveDialog open={open} onOpenChange={handleClose}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Dela hästprofil för {horseName}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Skapa en delbar länk till hästens uppgifter och vårdhistorik. Länken
              är giltig i 30 dagar och kan delas med veterinär, hovslagare eller
              andra som behöver se hästens historik.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {!profileUrl ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Den delade sidan visar:
              </p>
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                <li>Hästens grundinfo (namn, ras, ålder, färg)</li>
                <li>Registreringsnummer (UELN) och chipnummer</li>
                <li>Genomförda bokningar</li>
                <li>Veterinär-, hovslagare- och medicinanteckningar</li>
              </ul>
              <p className="text-sm text-amber-600">
                Privata anteckningar (allmän, skada) visas inte.
              </p>
              <Button
                onClick={handleCreateProfile}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "Skapar länk..." : "Skapa delbar länk"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Delbar länk
                </label>
                <div className="flex gap-2">
                  <Input value={profileUrl} readOnly className="font-mono text-sm" />
                  <Button onClick={handleCopy} variant="outline">
                    Kopiera
                  </Button>
                </div>
              </div>
              {expiresAt && (
                <p className="text-sm text-gray-500">
                  Länken är giltig till {formatDate(expiresAt)}.
                </p>
              )}
              <p className="text-sm text-gray-500">
                Du kan skapa nya länkar när du vill. Varje länk är oberoende.
              </p>
            </div>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
