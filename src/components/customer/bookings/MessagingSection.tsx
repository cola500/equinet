"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MessagingDialog } from "./MessagingDialog"
import type { Booking } from "./types"

interface MessagingSectionProps {
  booking: Booking
}

export function MessagingSection({ booking }: MessagingSectionProps) {
  const [open, setOpen] = useState(false)

  const allowedStatuses = ["pending", "confirmed", "completed"]
  if (!allowedStatuses.includes(booking.status)) return null

  return (
    <div className="mt-3 pt-3 border-t">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        Meddelanden
      </Button>

      {open && (
        <MessagingDialog
          bookingId={booking.id}
          providerName={booking.provider.businessName}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  )
}
