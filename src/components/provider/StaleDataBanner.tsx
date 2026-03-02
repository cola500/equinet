"use client"

import { Clock } from "lucide-react"

interface Props {
  isStale: boolean
}

export function StaleDataBanner({ isStale }: Props) {
  if (!isStale) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-200 px-4 py-1.5"
    >
      <div className="container mx-auto flex items-center gap-2 text-xs text-amber-700">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Data kan vara inaktuell. Anslut till internet för att uppdatera.</span>
      </div>
    </div>
  )
}
