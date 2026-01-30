"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface SharePassportDialogProps {
  horseId: string
  horseName: string
}

export function SharePassportDialog({
  horseId,
  horseName,
}: SharePassportDialogProps) {
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [passportUrl, setPassportUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const handleCreatePassport = async () => {
    setIsCreating(true)
    try {
      const response = await fetch(`/api/horses/${horseId}/passport`, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte skapa delbar lank")
      }

      const data = await response.json()
      setPassportUrl(data.url)
      setExpiresAt(data.expiresAt)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte skapa delbar lank"
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!passportUrl) return
    try {
      await navigator.clipboard.writeText(passportUrl)
      toast.success("Lanken kopierad!")
    } catch {
      // Fallback for browsers without clipboard API
      toast.error("Kunde inte kopiera. Markera lanken och kopiera manuellt.")
    }
  }

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when closing
      setPassportUrl(null)
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Dela hastpass
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dela hastpass for {horseName}</DialogTitle>
          <DialogDescription>
            Skapa en delbar lank till hastens profil och vardhistorik. Lanken
            ar giltig i 30 dagar och kan delas med veterinar, hovslagare eller
            andra som behover se hastens historik.
          </DialogDescription>
        </DialogHeader>

        {!passportUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Den delade sidan visar:
            </p>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
              <li>Hastens grundinfo (namn, ras, alder, farg)</li>
              <li>Genomforda bokningar</li>
              <li>Veterinar-, hovslagare- och medicinanteckningar</li>
            </ul>
            <p className="text-sm text-amber-600">
              Privata anteckningar (allman, skada) visas inte.
            </p>
            <Button
              onClick={handleCreatePassport}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? "Skapar lank..." : "Skapa delbar lank"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Delbar lank
              </label>
              <div className="flex gap-2">
                <Input value={passportUrl} readOnly className="font-mono text-sm" />
                <Button onClick={handleCopy} variant="outline">
                  Kopiera
                </Button>
              </div>
            </div>
            {expiresAt && (
              <p className="text-sm text-gray-500">
                Lanken ar giltig till {formatDate(expiresAt)}.
              </p>
            )}
            <p className="text-sm text-gray-500">
              Du kan skapa nya lankar nar du vill. Varje lank ar oberoende.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
