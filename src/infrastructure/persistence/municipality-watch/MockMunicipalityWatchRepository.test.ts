import { describe, it, expect, beforeEach } from "vitest"
import { MockMunicipalityWatchRepository } from "./MockMunicipalityWatchRepository"

describe("MockMunicipalityWatchRepository", () => {
  let repo: MockMunicipalityWatchRepository

  beforeEach(() => {
    repo = new MockMunicipalityWatchRepository()
  })

  describe("create", () => {
    it("should create a municipality watch", async () => {
      const watch = await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      expect(watch).toMatchObject({
        customerId: "customer-1",
        municipality: "Kungsbacka",
        serviceTypeName: "Hovslagning",
      })
      expect(watch.id).toBeDefined()
      expect(watch.createdAt).toBeInstanceOf(Date)
    })

    it("should return existing watch on duplicate (idempotent)", async () => {
      const first = await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      const second = await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      expect(second.id).toBe(first.id)
    })

    it("should allow same customer to watch different services in same municipality", async () => {
      const w1 = await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      const w2 = await repo.create("customer-1", "Kungsbacka", "Tandrasp")

      expect(w1.id).not.toBe(w2.id)
    })

    it("should allow same customer to watch same service in different municipalities", async () => {
      const w1 = await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      const w2 = await repo.create("customer-1", "Mölndal", "Hovslagning")

      expect(w1.id).not.toBe(w2.id)
    })
  })

  describe("delete", () => {
    it("should delete an existing watch and return true", async () => {
      const watch = await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      const result = await repo.delete(watch.id, "customer-1")

      expect(result).toBe(true)
      const watches = await repo.findByCustomerId("customer-1")
      expect(watches).toHaveLength(0)
    })

    it("should return false if watch not found", async () => {
      const result = await repo.delete("nonexistent", "customer-1")
      expect(result).toBe(false)
    })

    it("should return false if customerId does not match (ownership check)", async () => {
      const watch = await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      const result = await repo.delete(watch.id, "customer-2")

      expect(result).toBe(false)
      // Watch should still exist
      const watches = await repo.findByCustomerId("customer-1")
      expect(watches).toHaveLength(1)
    })
  })

  describe("findByCustomerId", () => {
    it("should return empty array when no watches", async () => {
      const watches = await repo.findByCustomerId("customer-1")
      expect(watches).toEqual([])
    })

    it("should return all watches for a customer", async () => {
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      await repo.create("customer-1", "Mölndal", "Tandrasp")
      await repo.create("customer-2", "Kungsbacka", "Hovslagning")

      const watches = await repo.findByCustomerId("customer-1")
      expect(watches).toHaveLength(2)
      expect(watches.every((w) => w.customerId === "customer-1")).toBe(true)
    })
  })

  describe("countByCustomerId", () => {
    it("should return 0 when no watches", async () => {
      const count = await repo.countByCustomerId("customer-1")
      expect(count).toBe(0)
    })

    it("should return correct count", async () => {
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      await repo.create("customer-1", "Mölndal", "Tandrasp")

      const count = await repo.countByCustomerId("customer-1")
      expect(count).toBe(2)
    })
  })

  describe("findWatchersForAnnouncement", () => {
    it("should return empty array when no watchers in municipality", async () => {
      repo.setUserData("customer-1", { email: "anna@example.com", firstName: "Anna" })
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      const watchers = await repo.findWatchersForAnnouncement("Mölndal", ["Hovslagning"])
      expect(watchers).toEqual([])
    })

    it("should return watchers matching municipality and service type", async () => {
      repo.setUserData("customer-1", { email: "anna@example.com", firstName: "Anna" })
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      const watchers = await repo.findWatchersForAnnouncement("Kungsbacka", ["Hovslagning"])
      expect(watchers).toHaveLength(1)
      expect(watchers[0]).toEqual({
        userId: "customer-1",
        email: "anna@example.com",
        firstName: "Anna",
      })
    })

    it("should not return watchers for non-matching service type", async () => {
      repo.setUserData("customer-1", { email: "anna@example.com", firstName: "Anna" })
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      const watchers = await repo.findWatchersForAnnouncement("Kungsbacka", ["Tandrasp"])
      expect(watchers).toEqual([])
    })

    it("should match case-insensitively on service type name", async () => {
      repo.setUserData("customer-1", { email: "anna@example.com", firstName: "Anna" })
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")

      const watchers = await repo.findWatchersForAnnouncement("Kungsbacka", ["hovslagning"])
      expect(watchers).toHaveLength(1)
    })

    it("should deduplicate -- one notification per customer even with multiple matching watches", async () => {
      repo.setUserData("customer-1", { email: "anna@example.com", firstName: "Anna" })
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      await repo.create("customer-1", "Kungsbacka", "Hovvård")

      const watchers = await repo.findWatchersForAnnouncement("Kungsbacka", ["Hovslagning", "Hovvård"])
      expect(watchers).toHaveLength(1)
    })

    it("should return multiple different customers", async () => {
      repo.setUserData("customer-1", { email: "anna@example.com", firstName: "Anna" })
      repo.setUserData("customer-2", { email: "erik@example.com", firstName: "Erik" })
      await repo.create("customer-1", "Kungsbacka", "Hovslagning")
      await repo.create("customer-2", "Kungsbacka", "Hovslagning")

      const watchers = await repo.findWatchersForAnnouncement("Kungsbacka", ["Hovslagning"])
      expect(watchers).toHaveLength(2)
    })
  })
})
