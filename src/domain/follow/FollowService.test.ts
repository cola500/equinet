import { describe, it, expect, beforeEach } from "vitest"
import { FollowService } from "./FollowService"
import { MockFollowRepository } from "@/infrastructure/persistence/follow/MockFollowRepository"

describe("FollowService", () => {
  let service: FollowService
  let repo: MockFollowRepository
  // Simulated providers
  const activeProviders = new Map<string, { isActive: boolean }>()

  beforeEach(() => {
    repo = new MockFollowRepository()
    activeProviders.clear()
    activeProviders.set("provider-1", { isActive: true })
    activeProviders.set("provider-inactive", { isActive: false })

    service = new FollowService(repo, {
      findProvider: async (id: string) => activeProviders.get(id) || null,
    })
  })

  describe("follow", () => {
    it("should return error when provider does not exist", async () => {
      const result = await service.follow("customer-1", "nonexistent")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("PROVIDER_NOT_FOUND")
      }
    })

    it("should return error when provider is inactive", async () => {
      const result = await service.follow("customer-1", "provider-inactive")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("PROVIDER_INACTIVE")
      }
    })

    it("should create follow successfully", async () => {
      const result = await service.follow("customer-1", "provider-1")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.customerId).toBe("customer-1")
        expect(result.value.providerId).toBe("provider-1")
      }
    })

    it("should be idempotent -- following again returns success", async () => {
      await service.follow("customer-1", "provider-1")
      const result = await service.follow("customer-1", "provider-1")

      expect(result.ok).toBe(true)
    })
  })

  describe("unfollow", () => {
    it("should unfollow successfully", async () => {
      await service.follow("customer-1", "provider-1")
      const result = await service.unfollow("customer-1", "provider-1")

      expect(result.ok).toBe(true)
    })

    it("should be idempotent -- unfollowing when not following returns success", async () => {
      const result = await service.unfollow("customer-1", "provider-1")

      expect(result.ok).toBe(true)
    })
  })

  describe("isFollowing", () => {
    it("should return true when following", async () => {
      await service.follow("customer-1", "provider-1")

      expect(await service.isFollowing("customer-1", "provider-1")).toBe(true)
    })

    it("should return false when not following", async () => {
      expect(await service.isFollowing("customer-1", "provider-1")).toBe(false)
    })
  })

  describe("getFollowedProviders", () => {
    it("should return list of followed providers", async () => {
      await service.follow("customer-1", "provider-1")

      const providers = await service.getFollowedProviders("customer-1")

      expect(providers).toHaveLength(1)
      expect(providers[0].providerId).toBe("provider-1")
    })
  })

  describe("getFollowerCount", () => {
    it("should return correct count", async () => {
      await service.follow("customer-1", "provider-1")
      await service.follow("customer-2", "provider-1")

      expect(await service.getFollowerCount("provider-1")).toBe(2)
    })
  })
})
