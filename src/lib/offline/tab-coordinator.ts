/**
 * Multi-tab sync coordination via BroadcastChannel.
 *
 * Ensures only one browser tab runs processMutationQueue() at a time.
 * Tabs that can't acquire the lock back off and wait for SYNC_COMPLETED.
 *
 * Fallback: If BroadcastChannel is unavailable (older Safari), the lock
 * is always granted -- the module-level guard in useMutationSync.ts still
 * prevents concurrent sync within the same tab.
 */

import { debugLog } from "./debug-logger"

type MessageType = "SYNC_STARTED" | "SYNC_ACK" | "SYNC_COMPLETED" | "CACHE_UPDATED"

interface CoordinatorMessage {
  type: MessageType
  tabId: string
}

export interface TabCoordinator {
  /** Try to acquire the sync lock. Returns true if this tab should sync. */
  acquireSyncLock(): Promise<boolean>
  /** Release the lock and notify other tabs that sync is done. */
  releaseSyncLock(): void
  /** Register callback for when another tab completes sync. */
  onSyncCompleted(callback: () => void): void
  /** Register callback for when another tab updates cache. */
  onCacheUpdated(callback: () => void): void
  /** Clean up the BroadcastChannel. */
  destroy(): void
}

const CHANNEL_NAME = "equinet-sync"
const LOCK_TIMEOUT_MS = 300
const MAX_SYNC_DURATION_MS = 5 * 60 * 1000 // 5 min

let tabIdCounter = 0

export function createTabCoordinator(): TabCoordinator {
  const tabId = `tab-${Date.now()}-${++tabIdCounter}`
  const hasBroadcastChannel = typeof globalThis.BroadcastChannel !== "undefined"

  let channel: BroadcastChannel | null = null
  let isLocked = false
  let receivedAck = false
  let syncStartedAt: number | null = null
  const syncCompletedCallbacks: Array<() => void> = []
  const cacheUpdatedCallbacks: Array<() => void> = []

  if (hasBroadcastChannel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = handleMessage
  }

  function safeBroadcast(msg: CoordinatorMessage): void {
    try {
      channel?.postMessage(msg)
    } catch {
      debugLog("sync", "warn", "BroadcastChannel error, falling back to local lock")
      channel?.close()
      channel = null
    }
  }

  function handleMessage(event: MessageEvent<CoordinatorMessage>) {
    const msg = event.data
    if (!msg || !msg.type) return

    switch (msg.type) {
      case "SYNC_STARTED":
        // Another tab wants to sync -- if we hold the lock, deny it
        if (isLocked && msg.tabId !== tabId) {
          if (syncStartedAt && Date.now() - syncStartedAt > MAX_SYNC_DURATION_MS) {
            // Lock expired after 5 min -- release it
            isLocked = false
            syncStartedAt = null
            debugLog("sync", "warn", "Lock expired after 5 min, releasing")
          } else {
            safeBroadcast({ type: "SYNC_ACK", tabId })
          }
        }
        break
      case "SYNC_ACK":
        // Another tab has the lock -- mark that we received a denial
        if (msg.tabId !== tabId) {
          receivedAck = true
        }
        break
      case "SYNC_COMPLETED":
        syncCompletedCallbacks.forEach((cb) => cb())
        break
      case "CACHE_UPDATED":
        cacheUpdatedCallbacks.forEach((cb) => cb())
        break
    }
  }

  return {
    async acquireSyncLock(): Promise<boolean> {
      if (!channel) {
        isLocked = true
        syncStartedAt = Date.now()
        return true
      }

      receivedAck = false
      safeBroadcast({ type: "SYNC_STARTED", tabId })

      // Wait for potential ACKs from other tabs
      await new Promise<void>((resolve) => setTimeout(resolve, LOCK_TIMEOUT_MS))

      if (receivedAck) {
        isLocked = false
        return false
      }

      isLocked = true
      syncStartedAt = Date.now()
      return true
    },

    releaseSyncLock(): void {
      isLocked = false
      syncStartedAt = null
      safeBroadcast({ type: "SYNC_COMPLETED", tabId })
      safeBroadcast({ type: "CACHE_UPDATED", tabId })
    },

    onSyncCompleted(callback: () => void): void {
      syncCompletedCallbacks.push(callback)
    },

    onCacheUpdated(callback: () => void): void {
      cacheUpdatedCallbacks.push(callback)
    },

    destroy(): void {
      isLocked = false
      if (channel) {
        channel.close()
        channel = null
      }
    },
  }
}
