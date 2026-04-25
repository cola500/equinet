"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Send, Merge, Loader2 } from "lucide-react"
import { CustomerMergeDialog } from "./CustomerMergeDialog"
import type { Customer } from "./types"

function isSentinelEmail(email: string) {
  return email.includes("@ghost.equinet.se")
}

interface CustomerActionsProps {
  customer: Customer
  onEditCustomer: (customer: Customer) => void
  onDeleteCustomer: (customer: Customer) => void
  onMergeSuccess?: () => void
}

export function CustomerActions({
  customer,
  onEditCustomer,
  onDeleteCustomer,
  onMergeSuccess,
}: CustomerActionsProps) {
  const [isInviting, setIsInviting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sent" | "error">("idle")
  const [showMergeDialog, setShowMergeDialog] = useState(false)

  const canInvite = customer.isManuallyAdded && !isSentinelEmail(customer.email)
  const canMerge = customer.isManuallyAdded

  const handleInvite = async () => {
    if (isInviting) return
    setIsInviting(true)
    setInviteStatus("idle")

    try {
      const res = await fetch(`/api/provider/customers/${customer.id}/invite`, {
        method: "POST",
      })

      if (res.ok) {
        setInviteStatus("sent")
      } else {
        setInviteStatus("error")
      }
    } catch {
      setInviteStatus("error")
    } finally {
      setIsInviting(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" })

  return (
    <>
      <div className="mt-4 pt-4 border-t">
        {customer.lastInviteSentAt && customer.lastInviteExpiresAt && (
          <p className="text-xs text-gray-500 mb-2">
            Inbjudan skickad {formatDate(customer.lastInviteSentAt)}, giltig till {formatDate(customer.lastInviteExpiresAt)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-800"
            onClick={() => onEditCustomer(customer)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Redigera kund
          </Button>
          {canInvite && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80"
              onClick={handleInvite}
              disabled={isInviting || inviteStatus === "sent"}
            >
              {isInviting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1" />
              )}
              {inviteStatus === "sent" ? "Inbjudan skickad" : "Skicka inbjudan"}
            </Button>
          )}
          {inviteStatus === "error" && (
            <span className="text-xs text-red-500">Kunde inte skicka inbjudan</span>
          )}
          {canMerge && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-800"
              onClick={() => setShowMergeDialog(true)}
            >
              <Merge className="h-3.5 w-3.5 mr-1" />
              Slå ihop
            </Button>
          )}
          {customer.isManuallyAdded && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDeleteCustomer(customer)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Ta bort kund
            </Button>
          )}
        </div>
      </div>

      <CustomerMergeDialog
        customer={customer}
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        onSuccess={onMergeSuccess}
      />
    </>
  )
}
