import { offlineDb, type MutationStatus, type PendingMutation } from "./db"

interface QueueMutationInput {
  method: "PUT" | "PATCH"
  url: string
  body: string
  entityType: PendingMutation["entityType"]
  entityId: string
}

/** Add a mutation to the offline queue. Returns the auto-incremented id. */
export async function queueMutation(input: QueueMutationInput): Promise<number> {
  const id = await offlineDb.pendingMutations.add({
    ...input,
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  })
  return id as number
}

/** Get all processable mutations (pending + failed) in FIFO order. */
export async function getPendingMutations(): Promise<PendingMutation[]> {
  return await offlineDb.pendingMutations
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("createdAt")
}

/** Get pending/failed mutations for a specific entity. */
export async function getPendingMutationsByEntity(
  entityId: string
): Promise<PendingMutation[]> {
  return await offlineDb.pendingMutations
    .where("entityId")
    .equals(entityId)
    .filter((m) => m.status === "pending" || m.status === "failed")
    .toArray()
}

/** Update the status (and optionally error message) of a mutation. */
export async function updateMutationStatus(
  id: number,
  status: MutationStatus,
  error?: string
): Promise<void> {
  const update: Partial<PendingMutation> = { status }
  if (error !== undefined) {
    update.error = error
  }
  await offlineDb.pendingMutations.update(id, update)
}

/** Increment the retry count by 1. */
export async function incrementRetryCount(id: number): Promise<void> {
  const mutation = await offlineDb.pendingMutations.get(id)
  if (mutation) {
    await offlineDb.pendingMutations.update(id, {
      retryCount: mutation.retryCount + 1,
    })
  }
}

/** Remove all mutations marked as synced. */
export async function removeSyncedMutations(): Promise<void> {
  await offlineDb.pendingMutations.where("status").equals("synced").delete()
}

/** Count of mutations that still need processing (pending + failed). */
export async function getPendingCount(): Promise<number> {
  return await offlineDb.pendingMutations
    .where("status")
    .anyOf("pending", "failed")
    .count()
}

/** Remove all mutations regardless of status. */
export async function clearAllMutations(): Promise<void> {
  await offlineDb.pendingMutations.clear()
}
