/**
 * Integration tests for the offline subsystem.
 * Tests end-to-end flows across mutation-queue, sync-engine, and cache-manager.
 */
import "fake-indexeddb/auto"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { offlineDb } from "../db"
import { queueMutation, getPendingMutations, getUnsyncedMutations, updateMutationStatus } from "../mutation-queue"
import { _processMutationQueueInternal as processMutationQueue, _resetTabCoordinator } from "../sync-engine"
import { cacheEndpoint, getCachedEndpoint, getCacheStats } from "../cache-manager"

interface MockResponse {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

function mockFetch(responses: Array<MockResponse | "TypeError">) {
  let callIndex = 0
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const response = responses[callIndex++]
    if (response === "TypeError") {
      throw new TypeError("Failed to fetch")
    }
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
      headers: { "Content-Type": "application/json", ...response.headers },
    })
  })
}

function mockDelays() {
  vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
    if (typeof fn === "function") fn()
    return 0 as unknown as ReturnType<typeof setTimeout>
  })
}

beforeEach(async () => {
  await offlineDb.pendingMutations.clear()
  await offlineDb.endpointCache.clear()
  await offlineDb.metadata.clear()
  await offlineDb.bookings.clear()
  await offlineDb.debugLogs.clear()
  _resetTabCoordinator()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("offline integration", () => {
  describe("end-to-end mutation sync flow", () => {
    it("should queue mutations offline and sync them all on reconnect", async () => {
      // Queue 3 mutations while "offline"
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: JSON.stringify({ notes: "Updated" }),
        entityType: "booking",
        entityId: "a",
      })
      await queueMutation({
        method: "PATCH",
        url: "/api/routes/r1/stops/s1",
        body: JSON.stringify({ status: "completed" }),
        entityType: "route-stop",
        entityId: "s1",
      })
      await queueMutation({
        method: "POST",
        url: "/api/bookings/manual",
        body: JSON.stringify({ service: "hoof-trim" }),
        entityType: "manual-booking",
        entityId: "temp-1",
      })

      // Verify all pending
      const pending = await getPendingMutations()
      expect(pending).toHaveLength(3)

      // "Reconnect" -- sync all
      mockFetch([{ status: 200 }, { status: 200 }, { status: 201 }])

      const result = await processMutationQueue()
      expect(result).toMatchObject({ synced: 3, failed: 0, conflicts: 0 })

      // All should be synced
      const remaining = await getUnsyncedMutations()
      expect(remaining).toHaveLength(0)
    })
  })

  describe("FIFO ordering", () => {
    it("should preserve insertion order across 5 mutations", async () => {
      for (let i = 1; i <= 5; i++) {
        await queueMutation({
          method: "PUT",
          url: `/api/bookings/${i}`,
          body: "{}",
          entityType: "booking",
          entityId: String(i),
        })
      }

      const fetchSpy = mockFetch([
        { status: 200 },
        { status: 200 },
        { status: 200 },
        { status: 200 },
        { status: 200 },
      ])

      await processMutationQueue()

      // Verify calls were made in order
      for (let i = 0; i < 5; i++) {
        expect(fetchSpy.mock.calls[i][0]).toBe(`/api/bookings/${i + 1}`)
      }
    })
  })

  describe("partial failure", () => {
    it("should sync 2 mutations, conflict 1, and continue processing", async () => {
      await queueMutation({ method: "PUT", url: "/api/bookings/a", body: "{}", entityType: "booking", entityId: "a" })
      await queueMutation({ method: "PUT", url: "/api/bookings/b", body: "{}", entityType: "booking", entityId: "b" })
      await queueMutation({ method: "PUT", url: "/api/bookings/c", body: "{}", entityType: "booking", entityId: "c" })

      mockFetch([{ status: 200 }, { status: 409 }, { status: 200 }])

      const result = await processMutationQueue()
      expect(result).toMatchObject({ synced: 2, conflicts: 1, failed: 0 })

      // Only the conflict should remain in unsynced
      const unsynced = await getUnsyncedMutations()
      expect(unsynced).toHaveLength(1)
      expect(unsynced[0].entityId).toBe("b")
      expect(unsynced[0].status).toBe("conflict")
    })
  })

  describe("mixed outcomes", () => {
    it("should handle 2 synced, 1 conflict, 1 failed in one run", async () => {
      mockDelays()
      await queueMutation({ method: "PUT", url: "/api/bookings/a", body: "{}", entityType: "booking", entityId: "a" })
      await queueMutation({ method: "PUT", url: "/api/bookings/b", body: "{}", entityType: "booking", entityId: "b" })
      await queueMutation({ method: "PUT", url: "/api/bookings/c", body: "{}", entityType: "booking", entityId: "c" })
      await queueMutation({ method: "PUT", url: "/api/bookings/d", body: "{}", entityType: "booking", entityId: "d" })

      mockFetch([
        { status: 200 },                      // a: synced
        { status: 409 },                      // b: conflict
        { status: 500 }, { status: 500 }, { status: 500 }, // c: failed (3 retries)
        { status: 200 },                      // d: synced
      ])

      const result = await processMutationQueue()
      expect(result).toMatchObject({ synced: 2, conflicts: 1, failed: 1 })
    })
  })

  describe("recovery after crash (stale syncing)", () => {
    it("should recover mutations stuck in syncing status", async () => {
      const id = await queueMutation({ method: "PUT", url: "/api/bookings/a", body: "{}", entityType: "booking", entityId: "a" })
      await updateMutationStatus(id, "syncing")

      // Simulate "crash recovery" -- processMutationQueue should reset syncing -> pending -> process
      mockFetch([{ status: 200 }])

      const result = await processMutationQueue()
      expect(result.synced).toBe(1)
    })
  })

  describe("cache + mutation integration", () => {
    it("cache stats reflect pending mutations", async () => {
      await cacheEndpoint("/api/bookings", [{ id: "1" }])
      await queueMutation({ method: "PUT", url: "/api/bookings/a", body: "{}", entityType: "booking", entityId: "a" })

      const stats = await getCacheStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.pendingMutations).toBe(1)
    })
  })

  describe("corrupt mutation handling", () => {
    it("should skip corrupt mutations and process valid ones", async () => {
      // Insert corrupt mutation directly
      await offlineDb.pendingMutations.add({
        // @ts-expect-error -- testing invalid data
        method: undefined,
        url: "/api/bookings/bad",
        body: "{}",
        entityType: "booking",
        entityId: "bad",
        createdAt: Date.now(),
        status: "pending",
        retryCount: 0,
      })
      // Insert valid mutation
      await queueMutation({ method: "PUT", url: "/api/bookings/good", body: "{}", entityType: "booking", entityId: "good" })

      mockFetch([{ status: 200 }])

      const result = await processMutationQueue()
      expect(result.synced).toBe(1)

      // Corrupt should be marked failed
      const all = await offlineDb.pendingMutations.toArray()
      const corrupt = all.find(m => m.entityId === "bad")
      expect(corrupt?.status).toBe("failed")
    })
  })

  describe("network failure mid-queue", () => {
    it("should sync first mutation and abort on network failure for second", async () => {
      await queueMutation({ method: "PUT", url: "/api/bookings/a", body: "{}", entityType: "booking", entityId: "a" })
      await queueMutation({ method: "PUT", url: "/api/bookings/b", body: "{}", entityType: "booking", entityId: "b" })

      mockFetch([{ status: 200 }, "TypeError"])

      const result = await processMutationQueue()
      expect(result.synced).toBe(1)
      expect(result.failed).toBe(0)

      // Second should be reverted to pending
      const all = await offlineDb.pendingMutations.toArray()
      const second = all.find(m => m.entityId === "b")
      expect(second?.status).toBe("pending")
    })
  })
})
