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
 * Called automatically when the browser "online" event fires,
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

function subscribe(callback: () => void) {
  const handleOnline = () => {
    reportConnectivityRestored()
    callback()
  }
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", callback)
  window.addEventListener("connectivity-change", callback)
  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", callback)
    window.removeEventListener("connectivity-change", callback)
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
 * Combines navigator.onLine with fetch-based connectivity detection.
 * On iOS Safari, navigator.onLine can stay true even when the network
 * is down. reportConnectivityLoss() overrides this when a real fetch fails.
 *
 * @returns true if online, false if offline
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
