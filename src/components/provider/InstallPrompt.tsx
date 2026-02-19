"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

const DISMISS_KEY = "equinet-install-dismissed"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches
}

export function InstallPrompt() {
  const isOfflineEnabled = useFeatureFlag("offline_mode")
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "true") {
      setDismissed(true)
      return
    }

    if (isIOS() && !isStandalone()) {
      setShowIOSGuide(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIOSGuide(false)
    localStorage.setItem(DISMISS_KEY, "true")
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
    }
  }

  if (!isOfflineEnabled || dismissed || isStandalone()) return null
  if (!deferredPrompt && !showIOSGuide) return null

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
      <div className="container mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-blue-800">
          {showIOSGuide ? (
            <>
              <Share className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">Lägg till på hemskärmen:</span>{" "}
                Tryck på Dela-ikonen och sedan &quot;Lägg till på
                hemskärmen&quot;.
              </span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">Installera Equinet</span> för
                snabbare åtkomst och offline-stöd.
              </span>
              <button
                onClick={handleInstall}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Installera
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-blue-600 hover:bg-blue-100 transition-colors"
          aria-label="Stäng"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
