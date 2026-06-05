"use client"

import Link from "next/link"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HomeStatus } from "@/lib/customer-home"

/**
 * The one-sentence answer to "behöver jag göra något?".
 * Calm (green) when nothing is overdue; a single factual alarm line with ONE
 * secondary-weight action when something is. Tone: "lugnt informera".
 */
export function HomeStatusLine({ status }: { status: HomeStatus }) {
  if (status.mode === "calm") {
    return (
      <div className="mb-6 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-600" aria-hidden />
        <p>
          {status.next ? (
            <>
              Inget är försenat. Nästa besök: <span className="font-medium">{status.next.horse}</span> ·{" "}
              {status.next.service} {format(new Date(status.next.date), "d MMMM", { locale: sv })}
            </>
          ) : (
            "Inget är försenat just nu."
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <p className="text-sm">
          <span className="font-medium">{status.horse}</span> behöver {status.service}
          {" — "}
          {status.daysOverdue} {status.daysOverdue === 1 ? "dag" : "dagar"} försenad
          {status.othersCount > 0 ? ` och ${status.othersCount} till` : ""}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-3 w-full sm:w-auto">
        <Link href="/providers">Boka {status.service.toLowerCase()}</Link>
      </Button>
    </div>
  )
}
