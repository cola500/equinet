"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Customer } from "./types"

interface CustomerMergeDialogProps {
  customer: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomerMergeDialog({
  customer,
  open,
  onOpenChange,
}: CustomerMergeDialogProps) {
  const [mergeEmail, setMergeEmail] = useState("")
  const [isMerging, setIsMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeSuccess, setMergeSuccess] = useState(false)

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setMergeEmail("")
      setMergeError(null)
      setMergeSuccess(false)
    }
    onOpenChange(isOpen)
  }

  const handleMerge = async () => {
    if (isMerging || !mergeEmail.trim()) return
    setIsMerging(true)
    setMergeError(null)

    try {
      const res = await fetch(`/api/provider/customers/${customer.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: mergeEmail.trim() }),
      })

      if (res.ok) {
        setMergeSuccess(true)
      } else {
        const data = await res.json()
        setMergeError(data.error || "Något gick fel")
      }
    } catch {
      setMergeError("Något gick fel. Försök igen.")
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slå ihop med riktigt konto</DialogTitle>
          <DialogDescription>
            All data (bokningar, hästar, recensioner) från {customer.firstName} {customer.lastName} flyttas
            till det riktiga kontot. Den manuella kundposten raderas sedan.
          </DialogDescription>
        </DialogHeader>

        {mergeSuccess ? (
          <div className="py-4">
            <p className="text-sm text-green-600 font-medium">
              Kunden har slagits ihop med det riktiga kontot.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800 font-medium">
                  Den här åtgärden är permanent och kan inte ångras.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="merge-email">E-postadress för målkontot</Label>
                <Input
                  id="merge-email"
                  type="email"
                  placeholder="kund@example.com"
                  value={mergeEmail}
                  onChange={(e) => setMergeEmail(e.target.value)}
                  disabled={isMerging}
                />
              </div>
              {mergeError && (
                <p className="text-sm text-red-600">{mergeError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpen(false)}
                disabled={isMerging}
              >
                Avbryt
              </Button>
              <Button
                variant="destructive"
                onClick={handleMerge}
                disabled={isMerging || !mergeEmail.trim()}
              >
                {isMerging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Slå ihop
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
