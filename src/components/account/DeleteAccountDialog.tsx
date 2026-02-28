"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogAction,
} from "@/components/ui/responsive-alert-dialog"

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const canSubmit = password.length > 0 && confirmation === "RADERA" && !isDeleting

  async function handleDelete() {
    if (!canSubmit) return

    setIsDeleting(true)
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Något gick fel")
        setIsDeleting(false)
        return
      }

      toast.success("Ditt konto har raderats")
      await signOut({ callbackUrl: "/" })
    } catch {
      toast.error("Kunde inte radera kontot. Försök igen.")
      setIsDeleting(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setPassword("")
      setConfirmation("")
      setIsDeleting(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <ResponsiveAlertDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>Radera mitt konto</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            Detta raderar ditt konto permanent. All personlig data anonymiseras
            och uppladdade filer tas bort. Bokningar och recensioner bevaras i
            anonymiserad form. Denna åtgärd kan inte ångras.
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="delete-password">Lösenord</Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Ange ditt lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isDeleting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              Skriv <span className="font-bold">RADERA</span> för att bekräfta
            </Label>
            <Input
              id="delete-confirmation"
              type="text"
              placeholder="RADERA"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={isDeleting}
            />
          </div>
        </div>

        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel disabled={isDeleting}>
            Avbryt
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={!canSubmit}
          >
            {isDeleting ? "Raderar..." : "Radera mitt konto"}
          </ResponsiveAlertDialogAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  )
}
