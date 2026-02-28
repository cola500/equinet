/**
 * SubscriptionGateway - Abstraction for subscription billing
 *
 * Defines a common interface for subscription providers (Stripe, etc).
 * Currently only MockSubscriptionGateway is implemented.
 * When integrating Stripe, add StripeSubscriptionGateway implementing
 * ISubscriptionGateway - no changes needed in routes or UI.
 */

// --- Request/Response Types ---

export interface CheckoutSessionRequest {
  providerId: string
  planId: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSessionResult {
  sessionId: string
  checkoutUrl: string
}

export interface CustomerPortalRequest {
  stripeCustomerId: string
  returnUrl: string
}

export interface CustomerPortalResult {
  portalUrl: string
}

export interface SubscriptionInfo {
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: string
  planId: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export interface WebhookEvent {
  type: string
  data: Record<string, unknown>
}

// --- Interface ---

export interface ISubscriptionGateway {
  createCheckoutSession(
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResult>
  createCustomerPortalSession(
    request: CustomerPortalRequest
  ): Promise<CustomerPortalResult>
  getSubscription(
    stripeSubscriptionId: string
  ): Promise<SubscriptionInfo | null>
  cancelSubscription(stripeSubscriptionId: string): Promise<void>
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): WebhookEvent | null
}

// --- MockSubscriptionGateway ---
// In-memory subscription store, no external calls. Used for development/demo.

export class MockSubscriptionGateway implements ISubscriptionGateway {
  private subscriptions = new Map<string, SubscriptionInfo>()

  async createCheckoutSession(
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResult> {
    const sessionId = `mock_cs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const subscriptionId = `mock_sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const customerId = `mock_cus_${request.providerId}`

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    this.subscriptions.set(subscriptionId, {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status: "active",
      planId: request.planId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    })

    return {
      sessionId,
      checkoutUrl: `https://mock-checkout.example.com/session/${sessionId}`,
    }
  }

  async createCustomerPortalSession(
    request: CustomerPortalRequest
  ): Promise<CustomerPortalResult> {
    return {
      portalUrl: `https://mock-portal.example.com/portal/${request.stripeCustomerId}`,
    }
  }

  async getSubscription(
    stripeSubscriptionId: string
  ): Promise<SubscriptionInfo | null> {
    return this.subscriptions.get(stripeSubscriptionId) ?? null
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(stripeSubscriptionId)
    if (sub) {
      sub.cancelAtPeriodEnd = true
    }
  }

  verifyWebhookSignature(
    payload: string,
    _signature: string
  ): WebhookEvent | null {
    try {
      const parsed = JSON.parse(payload)
      return {
        type: parsed.type,
        data: parsed.data,
      }
    } catch {
      return null
    }
  }

  /**
   * Helper for tests - returns all stored subscriptions.
   * Not part of the ISubscriptionGateway interface.
   */
  getStoredSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values())
  }
}

// --- Factory ---

/**
 * Factory function to get the appropriate subscription gateway.
 * Switch based on SUBSCRIPTION_PROVIDER env variable:
 *   undefined / "" / "mock" -> MockSubscriptionGateway
 *   "stripe" -> StripeSubscriptionGateway (requires STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET)
 */
export function getSubscriptionGateway(): ISubscriptionGateway {
  const provider = process.env.SUBSCRIPTION_PROVIDER

  if (provider === "stripe") {
    // Lazy import to avoid loading Stripe SDK in mock mode
    const { StripeSubscriptionGateway } = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("./StripeSubscriptionGateway")
      } catch {
        throw new Error(
          "Stripe gateway not available. Install stripe package: npm install stripe"
        )
      }
    })()
    return new StripeSubscriptionGateway()
  }

  return new MockSubscriptionGateway()
}
