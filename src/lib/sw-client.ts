import { SW_MESSAGE_CLEAR_USER_CACHES, SW_MESSAGE_USER_CACHES_CLEARED } from "./sw-messages"

/**
 * Ask the active service worker to delete every cache that may hold
 * per-user data (auth session, /api/* responses, rendered pages for
 * authenticated routes). Call this on logout so the next login on the same
 * browser never sees the previous user's cached data.
 *
 * No-ops (resolves immediately) when there is no service worker, no active
 * controller, or the SW never acknowledges -- logout must never hang on
 * this, so an unresponsive/unsupported SW is bounded by `timeoutMs`.
 */
export async function clearServiceWorkerUserCaches(timeoutMs = 1000): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  const controller = navigator.serviceWorker.controller
  if (!controller) return

  await new Promise<void>((resolve) => {
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const timer = setTimeout(settle, timeoutMs)
    const channel = new MessageChannel()
    channel.port1.onmessage = (event: MessageEvent) => {
      if (event.data?.type === SW_MESSAGE_USER_CACHES_CLEARED) {
        clearTimeout(timer)
        settle()
      }
    }
    controller.postMessage({ type: SW_MESSAGE_CLEAR_USER_CACHES }, [channel.port2])
  })
}
