import {
  getPendingMutations,
  updateMutationStatus,
  incrementRetryCount,
  resetStaleSyncingMutations,
} from "./mutation-queue"
import { debugLog } from "./debug-logger"
import { createTabCoordinator, type TabCoordinator } from "./tab-coordinator"

export interface SyncResult {
  synced: number
  failed: number
  conflicts: number
  rateLimited: number
  skippedByLock?: boolean
  circuitBroken?: boolean
}

// Singleton tab coordinator -- one per browser tab
let tabCoordinator: TabCoordinator | null = null

export function getTabCoordinator(): TabCoordinator {
  if (!tabCoordinator) {
    tabCoordinator = createTabCoordinator()
  }
  return tabCoordinator
}

/** Reset the tab coordinator. Test-only. */
export function _resetTabCoordinator(): void {
  tabCoordinator?.destroy()
  tabCoordinator = null
}

const MAX_RETRIES = 3
const MAX_TOTAL_RETRIES = 10
const CIRCUIT_BREAKER_THRESHOLD = 3
const CONFLICT_STATUSES = new Set([400, 403, 404, 409])
const BASE_RETRY_DELAY_MS = 1000
const PER_MUTATION_TIMEOUT_MS = 30_000

/**
 * Process the mutation queue in FIFO order.
 *
 * - 2xx: mark as "synced", dispatch event
 * - 400/403/404/409: mark as "conflict" (permanent, user must resolve)
 * - 429: retry with exponential backoff + Retry-After, then "rate-limited" (recoverable)
 * - 5xx: retry with exponential backoff, then "failed"
 * - TypeError (network down): abort entire queue, revert to "pending"
 */
export async function processMutationQueue(): Promise<SyncResult> {
  const coordinator = getTabCoordinator()
  const acquired = await coordinator.acquireSyncLock()
  if (!acquired) {
    await debugLog("sync", "info", "Sync lock denied -- another tab is syncing")
    return { synced: 0, failed: 0, conflicts: 0, rateLimited: 0, skippedByLock: true }
  }

  try {
    return await _processMutationQueueInternal()
  } finally {
    coordinator.releaseSyncLock()
  }
}

/** Internal queue processing (called after lock is acquired). Exported for testing. */
export async function _processMutationQueueInternal(): Promise<SyncResult> {
  // Recover any mutations stuck in "syncing" from a previous interrupted run
  await resetStaleSyncingMutations()

  const mutations = await getPendingMutations()
  const result: SyncResult = { synced: 0, failed: 0, conflicts: 0, rateLimited: 0 }

  await debugLog("sync", "info", `Starting sync: ${mutations.length} mutations to process`)

  let consecutiveServerErrors = 0

  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i]
    const id = mutation.id!

    // Max total retries guard -- skip mutations that have been retried too many times
    if (mutation.retryCount >= MAX_TOTAL_RETRIES) {
      await updateMutationStatus(id, "failed", `Max retries (${MAX_TOTAL_RETRIES}) exceeded`)
      result.failed++
      await debugLog("sync", "error", `Mutation ${id} exceeded max total retries`)
      continue
    }

    dispatchProgressEvent(i + 1, mutations.length, "processing")

    try {
      await updateMutationStatus(id, "syncing")

      const outcome = await attemptWithRetry(
        mutation.url,
        mutation.method,
        mutation.body,
        id
      )

      if (outcome === "synced") {
        await updateMutationStatus(id, "synced")
        result.synced++
        consecutiveServerErrors = 0
        dispatchSyncedEvent(mutation.entityType, mutation.entityId)
        await debugLog("sync", "info", `Mutation ${id} synced`, { entityType: mutation.entityType, url: mutation.url })
      } else if (outcome === "conflict") {
        result.conflicts++
        consecutiveServerErrors = 0
        await debugLog("sync", "warn", `Mutation ${id} conflict`, { entityType: mutation.entityType, url: mutation.url })
      } else if (outcome === "failed") {
        result.failed++
        consecutiveServerErrors++
        await debugLog("sync", "warn", `Mutation ${id} failed`, { entityType: mutation.entityType, url: mutation.url })
        if (consecutiveServerErrors >= CIRCUIT_BREAKER_THRESHOLD) {
          result.circuitBroken = true
          await debugLog("sync", "error", "Circuit breaker: 3 consecutive 5xx, pausing queue")
          break
        }
      } else if (outcome === "rate-limited") {
        await updateMutationStatus(id, "pending")
        result.rateLimited++
        await debugLog("sync", "warn", `Mutation ${id} rate-limited, aborting queue`, { entityType: mutation.entityType })
        break
      }
    } catch (error) {
      if (error instanceof TypeError) {
        // Network down -- revert to pending and abort
        await updateMutationStatus(id, "pending")
        await debugLog("sync", "warn", `Network error at mutation ${id}, aborting queue`)
        break
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        // Per-mutation timeout -- revert to pending, continue with next
        await updateMutationStatus(id, "pending")
        await debugLog("sync", "warn", `Mutation ${id} timed out, reverting to pending`)
        continue
      }
      // Unexpected error -- mark as failed
      await updateMutationStatus(id, "failed", String(error))
      result.failed++
    }
  }

  return result
}

type AttemptOutcome = "synced" | "conflict" | "failed" | "rate-limited"

async function attemptWithRetry(
  url: string,
  method: string,
  body: string,
  mutationId: number
): Promise<AttemptOutcome> {
  let lastStatus = 0

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const isDelete = method === "DELETE"
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PER_MUTATION_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(url, {
        method,
        signal: controller.signal,
        ...(isDelete ? {} : { headers: { "Content-Type": "application/json" }, body }),
      })
    } finally {
      clearTimeout(timeoutId)
    }

    lastStatus = response.status

    if (response.ok) {
      return "synced"
    }

    if (CONFLICT_STATUSES.has(response.status)) {
      let errorMessage = `HTTP ${response.status}`
      try {
        const body = await response.json()
        if (body?.error) {
          errorMessage = `HTTP ${response.status}: ${body.error}`
        }
      } catch {
        // Response not JSON -- keep generic message
      }
      await updateMutationStatus(mutationId, "conflict", errorMessage)
      return "conflict"
    }

    // Retryable (429, 5xx)
    await incrementRetryCount(mutationId)

    if (attempt < MAX_RETRIES - 1) {
      await delay(getRetryDelay(attempt, response))
    }
  }

  // Exhausted retries -- distinguish rate-limited (recoverable) from failed (permanent)
  if (lastStatus === 429) {
    return "rate-limited"
  }

  await updateMutationStatus(
    mutationId,
    "failed",
    `HTTP ${lastStatus} after ${MAX_RETRIES} retries`
  )
  return "failed"
}

/**
 * Calculate retry delay with exponential backoff.
 * Respects Retry-After header from 429 responses.
 */
function getRetryDelay(attempt: number, response?: Response): number {
  // Check Retry-After header (value in seconds)
  const retryAfter = response?.headers?.get("Retry-After")
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!isNaN(seconds) && seconds > 0) {
      return seconds * 1000
    }
  }

  // Exponential backoff with ±50% jitter: prevents thundering herd
  const base = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
  return Math.round(base * (0.5 + Math.random()))
}

function dispatchProgressEvent(current: number, total: number, status: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sync-progress", {
        detail: { current, total, status },
      })
    )
  }
}

function dispatchSyncedEvent(entityType: string, entityId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mutation-synced", {
        detail: { entityType, entityId },
      })
    )
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
