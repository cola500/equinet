"use client"

import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import type { SeriesResult } from "@/hooks/useBookingFlow"

interface SeriesResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SeriesResult | null
  onClose: () => void
}

export function SeriesResultDialog({
  open,
  onOpenChange,
  result,
  onClose,
}: SeriesResultDialogProps) {
  if (!result) return null

  const allCreated = result.createdCount === result.totalOccurrences
  const hasSkipped = result.skippedDates.length > 0

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {allCreated
              ? "Återkommande bokning skapad!"
              : "Återkommande bokning delvis skapad"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {result.serviceName}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-700">
              {result.createdCount} av {result.totalOccurrences}
            </p>
            <p className="text-sm text-gray-600">bokningar skapades</p>
          </div>

          <div className="text-sm space-y-1 bg-gray-50 p-3 rounded-md">
            <p>
              <span className="font-medium">Startdatum:</span>{" "}
              {new Date(result.firstBookingDate + "T00:00:00").toLocaleDateString("sv-SE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p>
              <span className="font-medium">Intervall:</span>{" "}
              {result.intervalWeeks === 1
                ? "Varje vecka"
                : `Var ${result.intervalWeeks}:e vecka`}
            </p>
          </div>

          {hasSkipped && (
            <div className="text-sm bg-amber-50 border border-amber-200 p-3 rounded-md">
              <p className="font-medium text-amber-800 mb-1">
                Hoppade datum:
              </p>
              <ul className="space-y-1">
                {result.skippedDates.map((s, i) => (
                  <li key={i} className="text-amber-700">
                    {new Date(s.date + "T00:00:00").toLocaleDateString("sv-SE", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    - {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter>
          <Button onClick={onClose} className="w-full">
            Visa mina bokningar
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
