/**
 * Native bridge utilities for iOS WKWebView communication.
 *
 * JS -> Swift: window.webkit.messageHandlers.equinet.postMessage(...)
 * Swift -> JS: window.equinetNative?.onMessage(...)
 */
import { clientLogger } from "@/lib/client-logger"

interface BridgeMessage {
  type: string
  payload?: Record<string, unknown>
}

interface WebKitWindow extends Window {
  webkit?: {
    messageHandlers: {
      equinet: {
        postMessage: (msg: BridgeMessage) => void
      }
    }
  }
}

/**
 * Check if we're running inside the iOS WKWebView app
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  return !!(window as WebKitWindow).webkit?.messageHandlers?.equinet
}

/**
 * Send a message to the native iOS app via the bridge
 */
export function sendToNative(type: string, payload?: Record<string, unknown>): void {
  const w = window as WebKitWindow
  if (!w.webkit?.messageHandlers?.equinet) return

  try {
    w.webkit.messageHandlers.equinet.postMessage({ type, payload })
  } catch (error) {
    clientLogger.error("Failed to send bridge message", { type, error })
  }
}

/**
 * Request a mobile token from the server and send it to the native app.
 * Called after successful login when running in WKWebView.
 */
export async function requestMobileTokenForNative(): Promise<void> {
  if (!isNativeApp()) return

  try {
    const res = await fetch("/api/auth/mobile-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceName: "iOS App" }),
    })

    if (!res.ok) {
      clientLogger.warn("Failed to generate mobile token", { status: res.status })
      return
    }

    const data = await res.json()
    sendToNative("requestMobileToken", {
      token: data.token,
      expiresAt: data.expiresAt,
    })
  } catch (error) {
    clientLogger.error("Error requesting mobile token", { error })
  }
}
