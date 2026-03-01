import {
  getPendingMutations,
  updateMutationStatus,
  incrementRetryCount,
  resetStaleSyncingMutations,
} from "./mutation-queue"
import { debugLog } from "./debug-logger"

export interface SyncResult {
  synced: number
  failed: number
  conflicts: number
  rateLimited: number
}

const MAX_RETRIES = 3
const CONFLICT_STATUSES = new Set([400, 403, 404, 409])
const BASE_RETRY_DELAY_MS = 1000

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
  // Recover any mutations stuck in "syncing" from a previous interrupted run
  await resetStaleSyncingMutations()

  const mutations = await getPendingMutations()
  const result: SyncResult = { synced: 0, failed: 0, conflicts: 0, rateLimited: 0 }

  await debugLog("sync", "info", `Starting sync: ${mutations.length} mutations to process`)

  for (const mutation of mutations) {
    const id = mutation.id!

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
        dispatchSyncedEvent(mutation.entityType, mutation.entityId)
        await debugLog("sync", "info", `Mutation ${id} synced`, { entityType: mutation.entityType, url: mutation.url })
      } else if (outcome === "conflict") {
        result.conflicts++
        await debugLog("sync", "warn", `Mutation ${id} conflict`, { entityType: mutation.entityType, url: mutation.url })
      } else if (outcome === "failed") {
        result.failed++
        await debugLog("sync", "warn", `Mutation ${id} failed`, { entityType: mutation.entityType, url: mutation.url })
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
    const response = await fetch(url, {
      method,
      ...(isDelete ? {} : { headers: { "Content-Type": "application/json" }, body }),
    })

    lastStatus = response.status

    if (response.ok) {
      return "synced"
    }

    if (CONFLICT_STATUSES.has(response.status)) {
      await updateMutationStatus(
        mutationId,
        "conflict",
        `HTTP ${response.status}`
      )
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

  // Exponential backoff: 1s, 2s, 4s, ...
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
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
