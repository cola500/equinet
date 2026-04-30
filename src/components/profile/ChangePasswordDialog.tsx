"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordsMatch = newPassword === confirmPassword
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    passwordsMatch &&
    !isSubmitting

  function reset() {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  function handleOpenChange(value: boolean) {
    if (!value) reset()
    onOpenChange(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Kunde inte byta lösenord")
        return
      }

      toast.success("Lösenordet har uppdaterats")
      handleOpenChange(false)
    } catch {
      toast.error("Något gick fel. Försök igen.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Byt lösenord</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Ange ditt nuvarande lösenord och välj ett nytt.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="current-password">Nuvarande lösenord</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              aria-label="Nuvarande lösenord"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-password">Nytt lösenord</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              aria-label="Nytt lösenord"
            />
            <p className="text-xs text-gray-500">
              Minst 8 tecken med stora/små bokstäver, siffra och specialtecken.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-password">Bekräfta nytt lösenord</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              aria-label="Bekräfta nytt lösenord"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-500" role="alert">
                Lösenorden matchar inte
              </p>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Uppdaterar…" : "Byt lösenord"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
