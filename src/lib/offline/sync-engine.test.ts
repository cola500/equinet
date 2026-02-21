import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import "fake-indexeddb/auto"
import { offlineDb } from "./db"
import { queueMutation, updateMutationStatus } from "./mutation-queue"
import { processMutationQueue, type SyncResult } from "./sync-engine"

beforeEach(async () => {
  await offlineDb.pendingMutations.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(responses: Array<{ status: number; body?: unknown } | "TypeError">) {
  let callIndex = 0
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const response = responses[callIndex++]
    if (response === "TypeError") {
      throw new TypeError("Failed to fetch")
    }
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  })
}

describe("sync-engine", () => {
  describe("processMutationQueue", () => {
    it("should return empty result when queue is empty", async () => {
      const result = await processMutationQueue()
      expect(result).toEqual({ synced: 0, failed: 0, conflicts: 0 })
    })

    it("should process mutations in FIFO order and mark synced on 2xx", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: JSON.stringify({ status: "completed" }),
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

      const fetchSpy = mockFetch([{ status: 200 }, { status: 200 }])

      const result = await processMutationQueue()

      expect(result).toEqual({ synced: 2, failed: 0, conflicts: 0 })
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      // Verify first call was the first mutation (FIFO)
      expect(fetchSpy.mock.calls[0][0]).toBe("/api/bookings/a")
      expect(fetchSpy.mock.calls[1][0]).toBe("/api/routes/r1/stops/s1")

      // Verify mutations marked as synced in DB
      const all = await offlineDb.pendingMutations.toArray()
      expect(all.every((m) => m.status === "synced")).toBe(true)
    })

    it("should dispatch mutation-synced event for each synced mutation", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "a",
      })

      mockFetch([{ status: 200 }])

      const events: CustomEvent[] = []
      const handler = (e: Event) => events.push(e as CustomEvent)
      window.addEventListener("mutation-synced", handler)

      await processMutationQueue()

      window.removeEventListener("mutation-synced", handler)
      expect(events).toHaveLength(1)
      expect(events[0].detail).toMatchObject({
        entityType: "booking",
        entityId: "a",
      })
    })

    it("should mark as conflict on 400/403/404/409", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "a",
      })

      mockFetch([{ status: 409, body: { error: "Bokningen har ändrats" } }])

      const result = await processMutationQueue()

      expect(result).toEqual({ synced: 0, failed: 0, conflicts: 1 })
      const all = await offlineDb.pendingMutations.toArray()
      expect(all[0].status).toBe("conflict")
      expect(all[0].error).toContain("409")
    })

    it("should retry on 5xx (up to max retries) then mark as failed", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })

      mockFetch([
        { status: 500 },
        { status: 500 },
        { status: 500 },
      ])

      const result = await processMutationQueue()

      expect(result).toEqual({ synced: 0, failed: 1, conflicts: 0 })
      const all = await offlineDb.pendingMutations.toArray()
      expect(all[0].status).toBe("failed")
      expect(all[0].retryCount).toBe(3)
    })

    it("should abort processing on TypeError (network down)", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/b",
        body: "{}",
        entityType: "booking",
        entityId: "b",
      })

      mockFetch(["TypeError"])

      const result = await processMutationQueue()

      // Should abort -- first one reverted to pending, second never attempted
      expect(result).toEqual({ synced: 0, failed: 0, conflicts: 0 })
      const all = await offlineDb.pendingMutations.toArray()
      expect(all.every((m) => m.status === "pending")).toBe(true)
    })

    it("should skip already synced/conflict mutations", async () => {
      const id = await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })
      await updateMutationStatus(id, "synced")

      await queueMutation({
        method: "PUT",
        url: "/api/bookings/b",
        body: "{}",
        entityType: "booking",
        entityId: "b",
      })

      const fetchSpy = mockFetch([{ status: 200 }])

      const result = await processMutationQueue()
      expect(result.synced).toBe(1)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][0]).toBe("/api/bookings/b")
    })

    it("should send correct method, headers and body", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "a",
      })

      const fetchSpy = mockFetch([{ status: 200 }])

      await processMutationQueue()

      expect(fetchSpy).toHaveBeenCalledWith("/api/bookings/a", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
    })

    it("should handle 429 as retryable", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })

      mockFetch([
        { status: 429 },
        { status: 429 },
        { status: 200 },
      ])

      const result = await processMutationQueue()
      expect(result.synced).toBe(1)
    })

    it("should process remaining mutations after a conflict", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/b",
        body: "{}",
        entityType: "booking",
        entityId: "b",
      })

      mockFetch([{ status: 409 }, { status: 200 }])

      const result = await processMutationQueue()
      expect(result).toEqual({ synced: 1, failed: 0, conflicts: 1 })
    })
  })
})
