import { useSyncExternalStore } from "react"

/**
 * Module-level state tracking actual connectivity.
 *
 * navigator.onLine is unreliable on iOS Safari -- it stays true even when
 * the network is actually down. This flag is set by reportConnectivityLoss()
 * when a real fetch fails, providing accurate offline detection.
 */
let fetchFailed = false

/**
 * Report that a network fetch has failed.
 * Call this from catch blocks when TypeError occurs (actual network failure).
 * This will cause useOnlineStatus() to return false even if navigator.onLine is true.
 */
export function reportConnectivityLoss() {
  if (!fetchFailed) {
    fetchFailed = true
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("connectivity-change"))
    }
  }
}

/**
 * Report that connectivity has been restored.
 * Called by the connectivity probe when network verification succeeds,
 * or manually when a fetch succeeds after a previous failure.
 */
export function reportConnectivityRestored() {
  if (fetchFailed) {
    fetchFailed = false
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("connectivity-change"))
    }
  }
}

// ---------------------------------------------------------------------------
// Connectivity probe + recovery
//
// iOS Safari keeps navigator.onLine = true even when WiFi drops. On tab
// return we do a single HEAD /api/health to check. The Service Worker's
// fetchDidFail plugin handles detection during normal browsing (zero cost).
//
// When offline, a recovery interval probes every 15s to detect when the
// network silently returns (no browser event, no tab switch). The interval
// stops immediately when connectivity is restored -- zero cost when online.
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 5_000
const RECOVERY_INTERVAL_MS = 15_000

let probeInFlight = false
let recoveryInterval: ReturnType<typeof setInterval> | null = null

async function probeConnectivity(): Promise<void> {
  if (typeof window === "undefined") return
  if (probeInFlight) return

  probeInFlight = true
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    await fetch(`/api/health?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeout)
    // Network reachable -- restore if we were marked offline
    reportConnectivityRestored()
  } catch {
    // Network unreachable -- mark offline
    reportConnectivityLoss()
  } finally {
    probeInFlight = false
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    probeConnectivity()
  }
}

function startRecoveryInterval() {
  if (recoveryInterval) return
  recoveryInterval = setInterval(() => probeConnectivity(), RECOVERY_INTERVAL_MS)
}

function stopRecoveryInterval() {
  if (recoveryInterval) {
    clearInterval(recoveryInterval)
    recoveryInterval = null
  }
}

/** Force-stop probing. Exported for test cleanup only. */
export function stopProbing() {
  document.removeEventListener("visibilitychange", handleVisibilityChange)
  stopRecoveryInterval()
}

// ---------------------------------------------------------------------------
// useSyncExternalStore plumbing
// ---------------------------------------------------------------------------

function subscribe(callback: () => void) {
  const handleOnline = () => {
    if (fetchFailed) {
      // We have evidence of network failure -- verify with a real probe
      // before restoring. iOS Safari fires false online events.
      probeConnectivity()
    }
    callback()
  }
  // Manage recovery interval based on connectivity state changes
  const handleConnectivityChange = () => {
    if (fetchFailed) {
      startRecoveryInterval()
    } else {
      stopRecoveryInterval()
    }
    callback()
  }

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", callback)
  window.addEventListener("connectivity-change", handleConnectivityChange)

  // Probe once on mount to catch iOS Safari stale onLine
  probeConnectivity()
  document.addEventListener("visibilitychange", handleVisibilityChange)

  // Listen for Service Worker fetch failures (zero-cost offline detection)
  const handleSwMessage = (event: MessageEvent) => {
    if (event.data?.type === "SW_FETCH_FAILED") {
      reportConnectivityLoss()
    }
  }
  navigator.serviceWorker?.addEventListener("message", handleSwMessage)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", callback)
    window.removeEventListener("connectivity-change", handleConnectivityChange)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
    navigator.serviceWorker?.removeEventListener("message", handleSwMessage)
    stopRecoveryInterval()
  }
}

function getSnapshot() {
  return navigator.onLine && !fetchFailed
}

function getServerSnapshot() {
  return true
}

/**
 * Hook that tracks the browser's online/offline status.
 *
 * Combines five detection strategies (zero cost when online):
 * 1. navigator.onLine + browser online/offline events (standard, but unreliable on iOS)
 * 2. Passive fetch-failure reporting via reportConnectivityLoss() (from SWR fetcher, error.tsx)
 * 3. Service Worker fetchDidFail -> postMessage (sub-second detection, zero server cost)
 * 4. Single HEAD /api/health probe on visibilitychange (catches iOS tab-return case)
 * 5. Recovery interval (15s) when offline -- auto-restores when network returns
 *
 * @returns true if online, false if offline
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
