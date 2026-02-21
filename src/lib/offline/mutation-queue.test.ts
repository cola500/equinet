import { describe, it, expect, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { offlineDb } from "./db"
import {
  queueMutation,
  getPendingMutations,
  getPendingMutationsByEntity,
  updateMutationStatus,
  incrementRetryCount,
  removeSyncedMutations,
  getPendingCount,
  clearAllMutations,
} from "./mutation-queue"

beforeEach(async () => {
  await offlineDb.pendingMutations.clear()
})

describe("mutation-queue", () => {
  describe("queueMutation", () => {
    it("should add a mutation to the queue and return its id", async () => {
      const id = await queueMutation({
        method: "PUT",
        url: "/api/bookings/abc123",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "abc123",
      })

      expect(id).toBeGreaterThan(0)
      const all = await offlineDb.pendingMutations.toArray()
      expect(all).toHaveLength(1)
      expect(all[0]).toMatchObject({
        method: "PUT",
        url: "/api/bookings/abc123",
        entityType: "booking",
        entityId: "abc123",
        status: "pending",
        retryCount: 0,
      })
    })

    it("should set createdAt to current timestamp", async () => {
      const before = Date.now()
      await queueMutation({
        method: "PATCH",
        url: "/api/routes/r1/stops/s1",
        body: JSON.stringify({ status: "completed" }),
        entityType: "route-stop",
        entityId: "s1",
      })
      const after = Date.now()

      const all = await offlineDb.pendingMutations.toArray()
      expect(all[0].createdAt).toBeGreaterThanOrEqual(before)
      expect(all[0].createdAt).toBeLessThanOrEqual(after)
    })
  })

  describe("getPendingMutations", () => {
    it("should return mutations in FIFO order (oldest first)", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/first",
        body: "{}",
        entityType: "booking",
        entityId: "first",
      })
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/second",
        body: "{}",
        entityType: "booking",
        entityId: "second",
      })

      const pending = await getPendingMutations()
      expect(pending).toHaveLength(2)
      expect(pending[0].entityId).toBe("first")
      expect(pending[1].entityId).toBe("second")
    })

    it("should only return pending and failed mutations", async () => {
      const id1 = await queueMutation({
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
      // Mark first as synced
      await updateMutationStatus(id1, "synced")

      const pending = await getPendingMutations()
      expect(pending).toHaveLength(1)
      expect(pending[0].entityId).toBe("b")
    })
  })

  describe("getPendingMutationsByEntity", () => {
    it("should return mutations for specific entity", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })
      await queueMutation({
        method: "PATCH",
        url: "/api/routes/r1/stops/s1",
        body: "{}",
        entityType: "route-stop",
        entityId: "s1",
      })

      const bookingMuts = await getPendingMutationsByEntity("a")
      expect(bookingMuts).toHaveLength(1)
      expect(bookingMuts[0].entityType).toBe("booking")
    })
  })

  describe("updateMutationStatus", () => {
    it("should update status of a mutation", async () => {
      const id = await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })

      await updateMutationStatus(id, "syncing")
      const mut = await offlineDb.pendingMutations.get(id)
      expect(mut?.status).toBe("syncing")
    })

    it("should store error message when setting to conflict", async () => {
      const id = await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })

      await updateMutationStatus(id, "conflict", "Bokningen har ändrats av en annan enhet")
      const mut = await offlineDb.pendingMutations.get(id)
      expect(mut?.status).toBe("conflict")
      expect(mut?.error).toBe("Bokningen har ändrats av en annan enhet")
    })
  })

  describe("incrementRetryCount", () => {
    it("should increment retry count by 1", async () => {
      const id = await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })

      await incrementRetryCount(id)
      let mut = await offlineDb.pendingMutations.get(id)
      expect(mut?.retryCount).toBe(1)

      await incrementRetryCount(id)
      mut = await offlineDb.pendingMutations.get(id)
      expect(mut?.retryCount).toBe(2)
    })
  })

  describe("removeSyncedMutations", () => {
    it("should remove only synced mutations", async () => {
      const id1 = await queueMutation({
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

      await updateMutationStatus(id1, "synced")
      await removeSyncedMutations()

      const all = await offlineDb.pendingMutations.toArray()
      expect(all).toHaveLength(1)
      expect(all[0].entityId).toBe("b")
    })
  })

  describe("getPendingCount", () => {
    it("should return count of pending and failed mutations", async () => {
      await queueMutation({
        method: "PUT",
        url: "/api/bookings/a",
        body: "{}",
        entityType: "booking",
        entityId: "a",
      })
      const id2 = await queueMutation({
        method: "PUT",
        url: "/api/bookings/b",
        body: "{}",
        entityType: "booking",
        entityId: "b",
      })
      await updateMutationStatus(id2, "synced")

      const count = await getPendingCount()
      expect(count).toBe(1)
    })
  })

  describe("clearAllMutations", () => {
    it("should remove all mutations regardless of status", async () => {
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

      await clearAllMutations()
      const all = await offlineDb.pendingMutations.toArray()
      expect(all).toHaveLength(0)
    })
  })
})
