import {
  getPendingMutations,
  updateMutationStatus,
  incrementRetryCount,
} from "./mutation-queue"

export interface SyncResult {
  synced: number
  failed: number
  conflicts: number
}

const MAX_RETRIES = 3
const CONFLICT_STATUSES = new Set([400, 403, 404, 409])

/**
 * Process the mutation queue in FIFO order.
 *
 * - 2xx: mark as "synced", dispatch event
 * - 400/403/404/409: mark as "conflict" (permanent, user must resolve)
 * - 429/5xx: retry up to MAX_RETRIES with inline delays, then "failed"
 * - TypeError (network down): abort entire queue, revert to "pending"
 */
export async function processMutationQueue(): Promise<SyncResult> {
  const mutations = await getPendingMutations()
  const result: SyncResult = { synced: 0, failed: 0, conflicts: 0 }

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
      } else if (outcome === "conflict") {
        result.conflicts++
        // Status already set inside attemptWithRetry
      } else if (outcome === "failed") {
        result.failed++
        // Status already set inside attemptWithRetry
      }
    } catch (error) {
      if (error instanceof TypeError) {
        // Network down -- revert to pending and abort
        await updateMutationStatus(id, "pending")
        break
      }
      // Unexpected error -- mark as failed
      await updateMutationStatus(id, "failed", String(error))
      result.failed++
    }
  }

  return result
}

type AttemptOutcome = "synced" | "conflict" | "failed"

async function attemptWithRetry(
  url: string,
  method: string,
  body: string,
  mutationId: number
): Promise<AttemptOutcome> {
  let lastStatus = 0

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
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
      // Brief inline delay -- not aggressive since we're already back online
      await delay(100)
    }
  }

  // Exhausted retries
  await updateMutationStatus(
    mutationId,
    "failed",
    `HTTP ${lastStatus} after ${MAX_RETRIES} retries`
  )
  return "failed"
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
