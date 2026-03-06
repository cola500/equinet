"use client"

import { WifiOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface OfflineNotAvailableProps {
  pageName: string
}

export function OfflineNotAvailable({ pageName }: OfflineNotAvailableProps) {
  return (
    <Card data-testid="offline-not-available">
      <CardContent className="py-12 text-center">
        <div className="mb-4">
          <WifiOff className="mx-auto h-12 w-12 text-amber-500" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Ej tillgänglig offline
        </h3>

        <p className="text-gray-600 max-w-md mx-auto">
          {pageName} kräver internetanslutning och kan inte användas offline.
        </p>
      </CardContent>
    </Card>
  )
}
