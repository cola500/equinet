"use client"

import { WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface OfflineErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function OfflineErrorState({
  title = "Du är offline",
  description = "Data kan inte hämtas utan internetanslutning.",
  onRetry,
}: OfflineErrorStateProps) {
  return (
    <Card data-testid="offline-error-state">
      <CardContent className="py-12 text-center">
        <div className="mb-4">
          <WifiOff className="mx-auto h-12 w-12 text-amber-500" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>

        <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>

        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Försök igen
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
