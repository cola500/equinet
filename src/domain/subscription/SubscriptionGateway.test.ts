import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  MockSubscriptionGateway,
  getSubscriptionGateway,
  type CheckoutSessionRequest,
  type CustomerPortalRequest,
} from "./SubscriptionGateway"

describe("MockSubscriptionGateway", () => {
  let gateway: MockSubscriptionGateway

  beforeEach(() => {
    gateway = new MockSubscriptionGateway()
  })

  describe("createCheckoutSession", () => {
    const request: CheckoutSessionRequest = {
      providerId: "provider-1",
      planId: "plan_pro_monthly",
      customerEmail: "test@example.com",
      successUrl: "https://equinet.se/subscription/success",
      cancelUrl: "https://equinet.se/subscription/cancel",
    }

    it("should return a sessionId and checkoutUrl", async () => {
      const result = await gateway.createCheckoutSession(request)

      expect(result.sessionId).toBeDefined()
      expect(result.sessionId).toMatch(/^mock_cs_/)
      expect(result.checkoutUrl).toBeDefined()
      expect(result.checkoutUrl).toContain("mock-checkout")
    })

    it("should generate unique session IDs for each call", async () => {
      const result1 = await gateway.createCheckoutSession(request)
      const result2 = await gateway.createCheckoutSession(request)

      expect(result1.sessionId).not.toBe(result2.sessionId)
    })

    it("should store the subscription as active after checkout", async () => {
      const result = await gateway.createCheckoutSession(request)

      // The mock stores a subscription keyed by the sessionId-derived subscription ID
      // We can verify by checking getSubscription with the stored ID
      const subscriptions = gateway.getStoredSubscriptions()
      expect(subscriptions.length).toBe(1)
      expect(subscriptions[0].status).toBe("active")
      expect(subscriptions[0].planId).toBe("plan_pro_monthly")
    })
  })

  describe("createCustomerPortalSession", () => {
    const request: CustomerPortalRequest = {
      stripeCustomerId: "cus_mock_123",
      returnUrl: "https://equinet.se/provider/settings",
    }

    it("should return a portalUrl", async () => {
      const result = await gateway.createCustomerPortalSession(request)

      expect(result.portalUrl).toBeDefined()
      expect(result.portalUrl).toContain("mock-portal")
    })
  })

  describe("getSubscription", () => {
    it("should return null for unknown subscription ID", async () => {
      const result = await gateway.getSubscription("sub_unknown_123")

      expect(result).toBeNull()
    })

    it("should return subscription info after checkout session creates one", async () => {
      const checkoutResult = await gateway.createCheckoutSession({
        providerId: "provider-1",
        planId: "plan_pro_monthly",
        successUrl: "https://equinet.se/success",
        cancelUrl: "https://equinet.se/cancel",
      })

      const subscriptions = gateway.getStoredSubscriptions()
      const sub = await gateway.getSubscription(
        subscriptions[0].stripeSubscriptionId
      )

      expect(sub).not.toBeNull()
      expect(sub!.status).toBe("active")
      expect(sub!.planId).toBe("plan_pro_monthly")
      expect(sub!.currentPeriodStart).toBeInstanceOf(Date)
      expect(sub!.currentPeriodEnd).toBeInstanceOf(Date)
      expect(sub!.cancelAtPeriodEnd).toBe(false)
    })
  })

  describe("cancelSubscription", () => {
    it("should not throw for any subscription ID", async () => {
      await expect(
        gateway.cancelSubscription("sub_unknown")
      ).resolves.toBeUndefined()
    })

    it("should set cancelAtPeriodEnd to true for existing subscription", async () => {
      await gateway.createCheckoutSession({
        providerId: "provider-1",
        planId: "plan_pro_monthly",
        successUrl: "https://equinet.se/success",
        cancelUrl: "https://equinet.se/cancel",
      })

      const subscriptions = gateway.getStoredSubscriptions()
      const subId = subscriptions[0].stripeSubscriptionId

      await gateway.cancelSubscription(subId)

      const sub = await gateway.getSubscription(subId)
      expect(sub).not.toBeNull()
      expect(sub!.cancelAtPeriodEnd).toBe(true)
    })
  })

  describe("verifyWebhookSignature", () => {
    it("should return parsed JSON as WebhookEvent", () => {
      const payload = JSON.stringify({
        type: "customer.subscription.updated",
        data: { subscriptionId: "sub_123" },
      })

      const result = gateway.verifyWebhookSignature(payload, "mock_sig")

      expect(result).not.toBeNull()
      expect(result!.type).toBe("customer.subscription.updated")
      expect(result!.data).toEqual({ subscriptionId: "sub_123" })
    })

    it("should return null for invalid JSON", () => {
      const result = gateway.verifyWebhookSignature("not-json", "mock_sig")

      expect(result).toBeNull()
    })
  })
})

describe("getSubscriptionGateway", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("should return MockSubscriptionGateway when SUBSCRIPTION_PROVIDER is not set", () => {
    vi.stubEnv("SUBSCRIPTION_PROVIDER", "")

    const gateway = getSubscriptionGateway()

    expect(gateway).toBeInstanceOf(MockSubscriptionGateway)
  })

  it("should return MockSubscriptionGateway when SUBSCRIPTION_PROVIDER is 'mock'", () => {
    vi.stubEnv("SUBSCRIPTION_PROVIDER", "mock")

    const gateway = getSubscriptionGateway()

    expect(gateway).toBeInstanceOf(MockSubscriptionGateway)
  })

  it("should throw when SUBSCRIPTION_PROVIDER is 'stripe' (not yet implemented)", () => {
    vi.stubEnv("SUBSCRIPTION_PROVIDER", "stripe")

    expect(() => getSubscriptionGateway()).toThrow("Stripe not configured")
  })
})
