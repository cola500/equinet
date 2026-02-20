"use client"

import { useEffect } from "react"
import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { debugLog } from "@/lib/offline/debug-logger"

export default function ProviderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (isOnline) {
      console.error("Provider error:", error)
    }
    debugLog("error", "error", `Provider error: ${error.message}`, {
      digest: error.digest,
      stack: error.stack?.slice(0, 500),
    })
  }, [error, isOnline])

  if (!isOnline) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-amber-100 p-6">
              <WifiOff
                className="h-12 w-12 text-amber-600"
                aria-hidden="true"
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Ingen internetanslutning
          </h2>
          <p className="text-gray-600 mb-6">
            Sidan kunde inte laddas. Kontrollera din internetanslutning och
            försök igen.
          </p>
          <Button onClick={reset} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Försök igen
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <AlertTriangle
              className="h-12 w-12 text-red-600"
              aria-hidden="true"
            />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Något gick fel
        </h2>
        <p className="text-gray-600 mb-6">
          Ett oväntat fel uppstod. Försök igen eller gå tillbaka till
          översikten.
        </p>
        <Button onClick={reset} size="lg">
          <RefreshCw className="mr-2 h-4 w-4" />
          Försök igen
        </Button>
      </div>
    </div>
  )
}
