import Stripe from "stripe"
import type { WebhookEvent } from "@/domain/subscription/SubscriptionGateway"

/**
 * Verify a Stripe webhook signature independently of PAYMENT_PROVIDER and
 * SUBSCRIPTION_PROVIDER configuration.
 *
 * The webhook route handles both payment_intent.* and subscription events.
 * Verification must NOT depend on which provider the app is configured with —
 * it always uses the Stripe SDK + STRIPE_WEBHOOK_SECRET.
 *
 * Returns a normalized event where `data` is the Stripe event's `data.object`
 * (e.g. the PaymentIntent for payment_intent.succeeded), or null when the
 * signature is invalid or the required secrets are missing.
 */
export function verifyStripeWebhook(
  payload: string,
  signature: string
): WebhookEvent | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    return null
  }

  try {
    const stripe = new Stripe(secretKey)
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    return {
      id: event.id,
      type: event.type,
      data: event.data.object as unknown as Record<string, unknown>,
    }
  } catch {
    return null
  }
}
