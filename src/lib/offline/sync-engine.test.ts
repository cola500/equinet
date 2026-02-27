import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import "fake-indexeddb/auto"
import { offlineDb } from "./db"
import { queueMutation, updateMutationStatus } from "./mutation-queue"
import { processMutationQueue } from "./sync-engine"

beforeEach(async () => {
  await offlineDb.pendingMutations.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

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
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...response.headers,
    }
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
      headers: responseHeaders,
    })
  })
}

/** Stub setTimeout-based delays to resolve instantly. */
function mockDelays() {
  vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler) => {
    if (typeof fn === "function") fn()
    return 0 as unknown as ReturnType<typeof setTimeout>
  })
}

describe("sync-engine", () => {
  describe("processMutationQueue", () => {
    it("should return empty result when queue is empty", async () => {
      const result = await processMutationQueue()
      expect(result).toEqual({ synced: 0, failed: 0, conflicts: 0, rateLimited: 0 })
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

      expect(result).toEqual({ synced: 2, failed: 0, conflicts: 0, rateLimited: 0 })
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

      expect(result).toEqual({ synced: 0, failed: 0, conflicts: 1, rateLimited: 0 })
      const all = await offlineDb.pendingMutations.toArray()
      expect(all[0].status).toBe("conflict")
      expect(all[0].error).toContain("409")
    })

    it("should retry on 5xx (up to max retries) then mark as failed", async () => {
      mockDelays()
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

      expect(result).toEqual({ synced: 0, failed: 1, conflicts: 0, rateLimited: 0 })
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
      expect(result).toEqual({ synced: 0, failed: 0, conflicts: 0, rateLimited: 0 })
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
      mockDelays()
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
      expect(result).toEqual({ synced: 1, failed: 0, conflicts: 1, rateLimited: 0 })
    })

    it("should use exponential backoff on 5xx retry", async () => {
      const delays: number[] = []
      vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler, ms?: number) => {
        delays.push(ms ?? 0)
        if (typeof fn === "function") fn()
        return 0 as unknown as ReturnType<typeof setTimeout>
      })

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

      await processMutationQueue()

      // 2 delays (between attempt 0->1 and 1->2, not after last)
      // Exponential backoff: 1000ms * 2^0 = 1000, 1000ms * 2^1 = 2000
      expect(delays).toContain(1000)
      expect(delays).toContain(2000)
    })

    it("should parse Retry-After header on 429", async () => {
      const delays: number[] = []
      vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: TimerHandler, ms?: number) => {
        delays.push(ms ?? 0)
        if (typeof fn === "function") fn()
        return 0 as unknown as ReturnType<typeof setTimeout>
      })

      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })

      mockFetch([
        { status: 429, headers: { "Retry-After": "5" } },
        { status: 429, headers: { "Retry-After": "10" } },
        { status: 429, headers: { "Retry-After": "5" } },
      ])

      await processMutationQueue()

      // Retry-After: 5 -> 5000ms, Retry-After: 10 -> 10000ms
      expect(delays).toContain(5000)
      expect(delays).toContain(10000)
    })

    it("should revert 429 to pending after max retries (rate-limited outcome)", async () => {
      mockDelays()
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
        { status: 429 },
      ])

      const result = await processMutationQueue()

      expect(result.rateLimited).toBe(1)
      expect(result.failed).toBe(0)

      const all = await offlineDb.pendingMutations.toArray()
      expect(all[0].status).toBe("pending")
    })

    it("should stop queue processing on rate-limited outcome", async () => {
      mockDelays()
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

      // First mutation gets 429 x3, second mutation should never be attempted
      const fetchSpy = mockFetch([
        { status: 429 },
        { status: 429 },
        { status: 429 },
      ])

      const result = await processMutationQueue()

      expect(result.rateLimited).toBe(1)
      // Only 3 fetch calls (retries for first mutation), not 6
      expect(fetchSpy).toHaveBeenCalledTimes(3)

      // Second mutation should still be pending
      const all = await offlineDb.pendingMutations.toArray()
      const second = all.find((m) => m.entityId === "b")
      expect(second?.status).toBe("pending")
    })

    it("should reset stale syncing mutations before processing", async () => {
      // Simulate a mutation stuck in "syncing" from a previous interrupted run
      const id = await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })
      await updateMutationStatus(id, "syncing")

      // Verify it's stuck in syncing
      const before = await offlineDb.pendingMutations.get(id)
      expect(before?.status).toBe("syncing")

      // processMutationQueue should recover it and process it
      mockFetch([{ status: 200 }])

      const result = await processMutationQueue()

      expect(result.synced).toBe(1)
      const all = await offlineDb.pendingMutations.toArray()
      expect(all[0].status).toBe("synced")
    })
  })
})
