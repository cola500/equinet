import { describe, it, expect, beforeEach } from "vitest"
import { MockFollowRepository } from "./MockFollowRepository"

describe("MockFollowRepository", () => {
  let repo: MockFollowRepository

  beforeEach(() => {
    repo = new MockFollowRepository()
  })

  describe("create", () => {
    it("should create a follow", async () => {
      const follow = await repo.create("customer-1", "provider-1")

      expect(follow).toMatchObject({
        customerId: "customer-1",
        providerId: "provider-1",
      })
      expect(follow.id).toBeDefined()
      expect(follow.createdAt).toBeInstanceOf(Date)
    })

    it("should handle duplicate gracefully (idempotent)", async () => {
      await repo.create("customer-1", "provider-1")
      const second = await repo.create("customer-1", "provider-1")

      expect(second.customerId).toBe("customer-1")
      expect(second.providerId).toBe("provider-1")
      // Should still only count as one
      const count = await repo.countByProvider("provider-1")
      expect(count).toBe(1)
    })
  })

  describe("delete", () => {
    it("should delete a follow", async () => {
      await repo.create("customer-1", "provider-1")
      const result = await repo.delete("customer-1", "provider-1")

      expect(result).toBe(true)
      const found = await repo.findByCustomerAndProvider("customer-1", "provider-1")
      expect(found).toBeNull()
    })

    it("should return false if follow does not exist", async () => {
      const result = await repo.delete("customer-1", "provider-1")
      expect(result).toBe(false)
    })
  })

  describe("findByCustomerAndProvider", () => {
    it("should find existing follow", async () => {
      await repo.create("customer-1", "provider-1")
      const found = await repo.findByCustomerAndProvider("customer-1", "provider-1")

      expect(found).not.toBeNull()
      expect(found!.customerId).toBe("customer-1")
      expect(found!.providerId).toBe("provider-1")
    })

    it("should return null for non-existing follow", async () => {
      const found = await repo.findByCustomerAndProvider("customer-1", "provider-1")
      expect(found).toBeNull()
    })
  })

  describe("findFollowersInMunicipality", () => {
    it("should return followers in matching municipality", async () => {
      repo.setUserData("customer-1", {
        email: "test@example.com",
        firstName: "Anna",
        municipality: "Alingsås",
      })
      await repo.create("customer-1", "provider-1")

      const followers = await repo.findFollowersInMunicipality("provider-1", "Alingsås")

      expect(followers).toHaveLength(1)
      expect(followers[0]).toEqual({
        userId: "customer-1",
        email: "test@example.com",
        firstName: "Anna",
      })
    })

    it("should exclude customers in different municipality", async () => {
      repo.setUserData("customer-1", {
        email: "test@example.com",
        firstName: "Anna",
        municipality: "Borås",
      })
      await repo.create("customer-1", "provider-1")

      const followers = await repo.findFollowersInMunicipality("provider-1", "Alingsås")

      expect(followers).toHaveLength(0)
    })

    it("should exclude customers without municipality", async () => {
      repo.setUserData("customer-1", {
        email: "test@example.com",
        firstName: "Anna",
        municipality: null,
      })
      await repo.create("customer-1", "provider-1")

      const followers = await repo.findFollowersInMunicipality("provider-1", "Alingsås")

      expect(followers).toHaveLength(0)
    })
  })

  describe("countByProvider", () => {
    it("should return correct count", async () => {
      await repo.create("customer-1", "provider-1")
      await repo.create("customer-2", "provider-1")
      await repo.create("customer-3", "provider-2")

      expect(await repo.countByProvider("provider-1")).toBe(2)
      expect(await repo.countByProvider("provider-2")).toBe(1)
      expect(await repo.countByProvider("provider-3")).toBe(0)
    })
  })
})
