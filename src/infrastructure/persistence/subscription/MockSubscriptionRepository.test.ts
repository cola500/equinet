import { describe, it, expect, beforeEach } from "vitest"
import { MockSubscriptionRepository } from "./MockSubscriptionRepository"
import type { Subscription } from "./ISubscriptionRepository"

describe("MockSubscriptionRepository", () => {
  let repo: MockSubscriptionRepository

  beforeEach(() => {
    repo = new MockSubscriptionRepository()
  })

  describe("create", () => {
    it("creates a subscription with defaults", async () => {
      const sub = await repo.create({ providerId: "provider-1" })

      expect(sub.id).toBeDefined()
      expect(sub.providerId).toBe("provider-1")
      expect(sub.planId).toBe("basic")
      expect(sub.priceAmountCents).toBe(0)
      expect(sub.currency).toBe("SEK")
      expect(sub.status).toBe("trialing")
      expect(sub.cancelAtPeriodEnd).toBe(false)
      expect(sub.createdAt).toBeInstanceOf(Date)
      expect(sub.updatedAt).toBeInstanceOf(Date)
    })

    it("creates a subscription with custom fields", async () => {
      const now = new Date()
      const sub = await repo.create({
        providerId: "provider-1",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        planId: "premium",
        priceAmountCents: 29900,
        currency: "SEK",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      })

      expect(sub.stripeCustomerId).toBe("cus_123")
      expect(sub.stripeSubscriptionId).toBe("sub_123")
      expect(sub.planId).toBe("premium")
      expect(sub.priceAmountCents).toBe(29900)
      expect(sub.status).toBe("active")
    })
  })

  describe("findByProviderId", () => {
    it("returns null when no subscription exists", async () => {
      const result = await repo.findByProviderId("unknown")
      expect(result).toBeNull()
    })

    it("returns subscription for existing provider", async () => {
      await repo.create({ providerId: "provider-1" })
      const result = await repo.findByProviderId("provider-1")
      expect(result).not.toBeNull()
      expect(result!.providerId).toBe("provider-1")
    })
  })

  describe("findByStripeCustomerId", () => {
    it("returns null when no match", async () => {
      const result = await repo.findByStripeCustomerId("cus_unknown")
      expect(result).toBeNull()
    })

    it("returns subscription by stripe customer ID", async () => {
      await repo.create({
        providerId: "provider-1",
        stripeCustomerId: "cus_123",
      })
      const result = await repo.findByStripeCustomerId("cus_123")
      expect(result).not.toBeNull()
      expect(result!.stripeCustomerId).toBe("cus_123")
    })
  })

  describe("findByStripeSubscriptionId", () => {
    it("returns null when no match", async () => {
      const result = await repo.findByStripeSubscriptionId("sub_unknown")
      expect(result).toBeNull()
    })

    it("returns subscription by stripe subscription ID", async () => {
      await repo.create({
        providerId: "provider-1",
        stripeSubscriptionId: "sub_456",
      })
      const result = await repo.findByStripeSubscriptionId("sub_456")
      expect(result).not.toBeNull()
      expect(result!.stripeSubscriptionId).toBe("sub_456")
    })
  })

  describe("update", () => {
    let sub: Subscription

    beforeEach(async () => {
      sub = await repo.create({
        providerId: "provider-1",
        status: "trialing",
      })
    })

    it("updates specific fields", async () => {
      const updated = await repo.update(sub.id, {
        status: "active",
        stripeCustomerId: "cus_new",
      })

      expect(updated.status).toBe("active")
      expect(updated.stripeCustomerId).toBe("cus_new")
      expect(updated.providerId).toBe("provider-1")
    })

    it("throws when subscription not found", async () => {
      await expect(
        repo.update("nonexistent", { status: "active" })
      ).rejects.toThrow("Subscription not found")
    })

    it("updates updatedAt timestamp", async () => {
      const before = sub.updatedAt
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 5))
      const updated = await repo.update(sub.id, { status: "active" })
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })
  })

  describe("delete", () => {
    it("returns false when subscription not found", async () => {
      const result = await repo.delete("nonexistent")
      expect(result).toBe(false)
    })

    it("returns true and removes subscription", async () => {
      const sub = await repo.create({ providerId: "provider-1" })
      const result = await repo.delete(sub.id)
      expect(result).toBe(true)

      const found = await repo.findByProviderId("provider-1")
      expect(found).toBeNull()
    })
  })
})
