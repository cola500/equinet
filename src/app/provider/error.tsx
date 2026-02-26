"use client"

import { useEffect, useSyncExternalStore } from "react"

/**
 * Inline online status -- replaces useOnlineStatus() to avoid chunk dependencies.
 * Error boundaries MUST be self-contained: if the error.tsx chunk itself can't load,
 * we get a cascade failure (the very thing this boundary is supposed to catch).
 */
function useInlineOnlineStatus() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("online", callback)
      window.addEventListener("offline", callback)
      return () => {
        window.removeEventListener("online", callback)
        window.removeEventListener("offline", callback)
      }
    },
    () => navigator.onLine,
    () => true // SSR: assume online
  )
}

/** Inline WifiOff icon (from lucide-react source, ~200 bytes) */
function WifiOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-600"
      aria-hidden="true"
    >
      <path d="M12 20h.01" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <path d="M13.83 10.17A10 10 0 0 1 19 12.86" />
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
      <path d="M10.66 5c4.01-.36 8.14.93 11.34 3.82" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

/** Inline AlertTriangle icon (from lucide-react source, ~150 bytes) */
function AlertTriangleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-600"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

/** Inline RefreshCw icon (from lucide-react source, ~200 bytes) */
function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-2"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

export default function ProviderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isOnline = useInlineOnlineStatus()

  useEffect(() => {
    // ChunkLoadError: chunk from stale deploy -- reload lets SW serve cached version or /~offline
    const msg = error.message ?? ""
    if (msg.includes("Loading chunk") || msg.includes("ChunkLoadError")) {
      if (!sessionStorage.getItem("chunk-reload-attempted")) {
        sessionStorage.setItem("chunk-reload-attempted", "1")
        window.location.reload()
        return
      }
    }

    // Clear the reload guard on successful render (non-chunk errors)
    sessionStorage.removeItem("chunk-reload-attempted")

    if (isOnline) {
      console.error("Provider error:", error)
    }
  }, [error, isOnline])

  if (!isOnline) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-amber-100 p-6">
              <WifiOffIcon />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Ingen internetanslutning
          </h2>
          <p className="text-gray-600 mb-6">
            Sidan kunde inte laddas. Kontrollera din internetanslutning och
            försök igen.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 h-11 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshIcon />
            Försök igen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <AlertTriangleIcon />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Något gick fel
        </h2>
        <p className="text-gray-600 mb-6">
          Ett oväntat fel uppstod. Försök igen eller gå tillbaka till
          översikten.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 h-11 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshIcon />
          Försök igen
        </button>
      </div>
    </div>
  )
}
