import { describe, it, expect, beforeEach, vi } from "vitest"
import { SubscriptionService } from "./SubscriptionService"
import { MockSubscriptionGateway } from "./SubscriptionGateway"
import { MockSubscriptionRepository } from "@/infrastructure/persistence/subscription/MockSubscriptionRepository"

describe("SubscriptionService", () => {
  let service: SubscriptionService
  let repo: MockSubscriptionRepository
  let gateway: MockSubscriptionGateway
  let checkFeature: ReturnType<typeof vi.fn>

  beforeEach(() => {
    repo = new MockSubscriptionRepository()
    gateway = new MockSubscriptionGateway()
    checkFeature = vi.fn().mockResolvedValue(true)
    service = new SubscriptionService(repo, gateway, checkFeature)
  })

  describe("initiateCheckout", () => {
    it("returns FEATURE_DISABLED when flag is off", async () => {
      checkFeature.mockResolvedValueOnce(false)
      const result = await service.initiateCheckout(
        "provider-1",
        "basic",
        "http://localhost/success",
        "http://localhost/cancel"
      )
      expect(result).toEqual({ ok: false, error: "FEATURE_DISABLED" })
    })

    it("returns ALREADY_SUBSCRIBED when active subscription exists", async () => {
      await repo.create({
        providerId: "provider-1",
        status: "active",
      })
      const result = await service.initiateCheckout(
        "provider-1",
        "basic",
        "http://localhost/success",
        "http://localhost/cancel"
      )
      expect(result).toEqual({ ok: false, error: "ALREADY_SUBSCRIBED" })
    })

    it("allows checkout when subscription is canceled", async () => {
      await repo.create({
        providerId: "provider-1",
        status: "canceled",
      })
      const result = await service.initiateCheckout(
        "provider-1",
        "basic",
        "http://localhost/success",
        "http://localhost/cancel"
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.checkoutUrl).toContain("mock-checkout")
      }
    })

    it("creates checkout session and returns URL", async () => {
      const result = await service.initiateCheckout(
        "provider-1",
        "basic",
        "http://localhost/success",
        "http://localhost/cancel"
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.checkoutUrl).toBeDefined()
        expect(result.value.sessionId).toBeDefined()
      }
    })
  })

  describe("getStatus", () => {
    it("returns FEATURE_DISABLED when flag is off", async () => {
      checkFeature.mockResolvedValueOnce(false)
      const result = await service.getStatus("provider-1")
      expect(result).toEqual({ ok: false, error: "FEATURE_DISABLED" })
    })

    it("returns null when no subscription exists", async () => {
      const result = await service.getStatus("provider-1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeNull()
      }
    })

    it("returns subscription status when exists", async () => {
      await repo.create({
        providerId: "provider-1",
        status: "active",
        planId: "basic",
        currentPeriodEnd: new Date("2026-04-01"),
        cancelAtPeriodEnd: false,
      })
      const result = await service.getStatus("provider-1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).not.toBeNull()
        expect(result.value!.status).toBe("active")
        expect(result.value!.planId).toBe("basic")
        expect(result.value!.cancelAtPeriodEnd).toBe(false)
      }
    })
  })

  describe("getPortalUrl", () => {
    it("returns FEATURE_DISABLED when flag is off", async () => {
      checkFeature.mockResolvedValueOnce(false)
      const result = await service.getPortalUrl("provider-1", "http://localhost/return")
      expect(result).toEqual({ ok: false, error: "FEATURE_DISABLED" })
    })

    it("returns NO_SUBSCRIPTION when no subscription exists", async () => {
      const result = await service.getPortalUrl("provider-1", "http://localhost/return")
      expect(result).toEqual({ ok: false, error: "NO_SUBSCRIPTION" })
    })

    it("returns NO_SUBSCRIPTION when no stripeCustomerId", async () => {
      await repo.create({
        providerId: "provider-1",
        status: "active",
      })
      const result = await service.getPortalUrl("provider-1", "http://localhost/return")
      expect(result).toEqual({ ok: false, error: "NO_SUBSCRIPTION" })
    })

    it("returns portal URL when subscription exists with stripeCustomerId", async () => {
      await repo.create({
        providerId: "provider-1",
        stripeCustomerId: "cus_123",
        status: "active",
      })
      const result = await service.getPortalUrl("provider-1", "http://localhost/return")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.portalUrl).toContain("mock-portal")
      }
    })
  })

  describe("handleWebhookEvent", () => {
    it("handles checkout.session.completed", async () => {
      // Pre-create subscription (would be created during checkout redirect in real flow)
      await repo.create({
        providerId: "provider-1",
        status: "trialing",
      })

      await service.handleWebhookEvent({
        type: "checkout.session.completed",
        data: {
          subscription: "sub_new",
          customer: "cus_new",
          metadata: { providerId: "provider-1" },
        },
      })

      const updated = await repo.findByProviderId("provider-1")
      expect(updated).not.toBeNull()
      expect(updated!.stripeSubscriptionId).toBe("sub_new")
      expect(updated!.stripeCustomerId).toBe("cus_new")
      expect(updated!.status).toBe("active")
    })

    it("creates subscription on checkout.session.completed if none exists", async () => {
      await service.handleWebhookEvent({
        type: "checkout.session.completed",
        data: {
          subscription: "sub_new",
          customer: "cus_new",
          metadata: { providerId: "provider-1" },
        },
      })

      const created = await repo.findByProviderId("provider-1")
      expect(created).not.toBeNull()
      expect(created!.status).toBe("active")
    })

    it("handles customer.subscription.updated", async () => {
      await repo.create({
        providerId: "provider-1",
        stripeSubscriptionId: "sub_123",
        status: "active",
      })

      await service.handleWebhookEvent({
        type: "customer.subscription.updated",
        data: {
          id: "sub_123",
          status: "past_due",
          cancel_at_period_end: true,
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        },
      })

      const updated = await repo.findByStripeSubscriptionId("sub_123")
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe("past_due")
      expect(updated!.cancelAtPeriodEnd).toBe(true)
    })

    it("handles customer.subscription.deleted", async () => {
      await repo.create({
        providerId: "provider-1",
        stripeSubscriptionId: "sub_123",
        status: "active",
      })

      await service.handleWebhookEvent({
        type: "customer.subscription.deleted",
        data: { id: "sub_123" },
      })

      const updated = await repo.findByStripeSubscriptionId("sub_123")
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe("canceled")
    })

    it("handles invoice.paid", async () => {
      await repo.create({
        providerId: "provider-1",
        stripeSubscriptionId: "sub_123",
        status: "past_due",
      })

      await service.handleWebhookEvent({
        type: "invoice.paid",
        data: {
          subscription: "sub_123",
        },
      })

      const updated = await repo.findByStripeSubscriptionId("sub_123")
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe("active")
    })

    it("ignores unknown event types", async () => {
      // Should not throw
      await service.handleWebhookEvent({
        type: "some.unknown.event",
        data: {},
      })
    })
  })
})
