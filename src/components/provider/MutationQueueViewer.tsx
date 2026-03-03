"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Clock, XCircle, Trash2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getUnsyncedMutations, updateMutationStatus } from "@/lib/offline/mutation-queue"
import type { PendingMutation, MutationStatus } from "@/lib/offline/db"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ENTITY_TYPE_LABELS: Record<PendingMutation["entityType"], string> = {
  "booking": "Bokning",
  "booking-notes": "Bokningsanteckning",
  "route-stop": "Ruttstopp",
  "availability-exception": "Undantag",
  "manual-booking": "Manuell bokning",
  "availability-schedule": "Schema",
  "horse-interval": "Hästintervall",
  "customer": "Kund",
  "customer-note": "Kundanteckning",
  "customer-horse": "Kundhäst",
  "service": "Tjänst",
}

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: typeof Clock }> = {
  pending: { label: "Väntande", color: "bg-yellow-100 text-yellow-800", Icon: Clock },
  syncing: { label: "Synkar", color: "bg-blue-100 text-blue-800", Icon: Clock },
  failed: { label: "Misslyckad", color: "bg-red-100 text-red-800", Icon: XCircle },
  conflict: { label: "Konflikt", color: "bg-orange-100 text-orange-800", Icon: AlertTriangle },
}

export function MutationQueueViewer({ open, onOpenChange }: Props) {
  const [mutations, setMutations] = useState<PendingMutation[]>([])
  const [confirmDismissId, setConfirmDismissId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    const unsynced = await getUnsyncedMutations()
    setMutations(unsynced)
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const handleDismiss = async (id: number) => {
    await updateMutationStatus(id, "synced" as MutationStatus)
    toast.info("Ändring borttagen")
    setConfirmDismissId(null)
    refresh()
  }

  const handleRetry = async (id: number) => {
    await updateMutationStatus(id, "pending" as MutationStatus)
    toast.info("Ändringen försöks igen vid nästa synk")
    refresh()
  }

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ändringsköer</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {mutations.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {mutations.length} {mutations.length === 1 ? "ändring" : "ändringar"}
            </p>
          )}

          {mutations.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Inga väntande ändringar
            </p>
          )}

          {mutations.map((m) => {
            const config = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending
            const StatusIcon = config.Icon
            return (
              <div
                key={m.id}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {ENTITY_TYPE_LABELS[m.entityType] ?? m.entityType}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {m.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(m.id!)}
                        aria-label="Försök igen"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span className="sr-only">Försök igen</span>
                      </Button>
                    )}
                    {(m.status === "conflict" || m.status === "failed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDismissId(m.id!)}
                        aria-label="Ignorera"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Ignorera</span>
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground truncate">
                  {m.method} {m.url}
                </p>

                {m.error && (
                  <p className="text-xs text-red-600">{m.error}</p>
                )}
              </div>
            )
          })}
        </div>
      </SheetContent>

      <AlertDialog open={confirmDismissId !== null} onOpenChange={(open) => { if (!open) setConfirmDismissId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorera ändring?</AlertDialogTitle>
            <AlertDialogDescription>
              Ändringen tas bort permanent och kan inte synkas igen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDismissId !== null && handleDismiss(confirmDismissId)}>
              Ja, ignorera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
