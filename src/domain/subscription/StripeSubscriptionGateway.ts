/**
 * StripeSubscriptionGateway - Real Stripe implementation
 *
 * Implements ISubscriptionGateway using the Stripe Node.js SDK.
 * Activated by setting SUBSCRIPTION_PROVIDER=stripe in env.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY - Stripe API secret key
 *   STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
 *   STRIPE_PRICE_ID_BASIC - Stripe Price ID for the basic plan
 */
import Stripe from "stripe"
import type {
  ISubscriptionGateway,
  CheckoutSessionRequest,
  CheckoutSessionResult,
  CustomerPortalRequest,
  CustomerPortalResult,
  SubscriptionInfo,
  WebhookEvent,
} from "./SubscriptionGateway"

export class StripeSubscriptionGateway implements ISubscriptionGateway {
  private stripe: Stripe
  private webhookSecret: string

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is required")
    }
    this.stripe = new Stripe(secretKey)

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is required")
    }
    this.webhookSecret = webhookSecret
  }

  async createCheckoutSession(
    request: CheckoutSessionRequest
  ): Promise<CheckoutSessionResult> {
    const priceId = this.getPriceId(request.planId)

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      ...(request.customerEmail && { customer_email: request.customerEmail }),
      metadata: {
        providerId: request.providerId,
        planId: request.planId,
      },
    })

    return {
      sessionId: session.id,
      checkoutUrl: session.url!,
    }
  }

  async createCustomerPortalSession(
    request: CustomerPortalRequest
  ): Promise<CustomerPortalResult> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: request.stripeCustomerId,
      return_url: request.returnUrl,
    })

    return {
      portalUrl: session.url,
    }
  }

  async getSubscription(
    stripeSubscriptionId: string
  ): Promise<SubscriptionInfo | null> {
    try {
      const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId)

      // In Stripe SDK v20+, current_period is on the item, not subscription
      const firstItem = sub.items.data[0]
      const periodStart = firstItem?.current_period_start
      const periodEnd = firstItem?.current_period_end

      return {
        stripeSubscriptionId: sub.id,
        stripeCustomerId: sub.customer as string,
        status: sub.status,
        planId: this.extractPlanId(sub),
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : new Date(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      }
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeError &&
        error.statusCode === 404
      ) {
        return null
      }
      throw error
    }
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
  }

  verifyWebhookSignature(
    payload: string,
    signature: string
  ): WebhookEvent | null {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      )

      return {
        type: event.type,
        data: event.data.object as unknown as Record<string, unknown>,
      }
    } catch {
      return null
    }
  }

  private getPriceId(planId: string): string {
    const priceMap: Record<string, string | undefined> = {
      basic: process.env.STRIPE_PRICE_ID_BASIC,
    }

    const priceId = priceMap[planId]
    if (!priceId) {
      throw new Error(`No Stripe Price ID configured for plan: ${planId}`)
    }
    return priceId
  }

  private extractPlanId(subscription: Stripe.Subscription): string {
    // Extract planId from subscription metadata or first item's price lookup_key
    const metadata = subscription.metadata
    if (metadata?.planId) return metadata.planId

    // Fallback: check first item's price nickname/lookup_key
    const firstItem = subscription.items.data[0]
    if (firstItem?.price?.lookup_key) return firstItem.price.lookup_key

    return "basic"
  }
}
