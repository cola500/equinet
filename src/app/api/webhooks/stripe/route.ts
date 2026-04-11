import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getSubscriptionGateway } from "@/domain/subscription/SubscriptionGateway"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"
import { createPaymentWebhookService } from "@/domain/payment"
import { stripeWebhookEventRepository } from "@/infrastructure/persistence/stripe/stripeWebhookEventRepository"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature") ?? ""

    const gateway = getSubscriptionGateway()
    const event = gateway.verifyWebhookSignature(body, signature)

    if (!event) {
      return NextResponse.json(
        { error: "Ogiltig signatur" },
        { status: 400 }
      )
    }

    // Event deduplication: atomic insert-or-ignore
    const isNewEvent = await stripeWebhookEventRepository.tryRecordEvent(
      event.id,
      event.type
    )
    if (!isNewEvent) {
      logger.info("Duplicate Stripe event skipped", { eventId: event.id })
      return NextResponse.json({ received: true })
    }

    try {
      if (event.type.startsWith("payment_intent.")) {
        const paymentService = createPaymentWebhookService()
        const paymentIntent = event.data as { id?: string; metadata?: Record<string, string> }
        const intentId = paymentIntent.id ?? ""
        const metadata = paymentIntent.metadata ?? {}

        if (event.type === "payment_intent.succeeded") {
          await paymentService.handlePaymentIntentSucceeded(intentId, metadata)
        } else if (event.type === "payment_intent.payment_failed") {
          await paymentService.handlePaymentIntentFailed(intentId, metadata)
        } else {
          logger.info("Unhandled payment_intent event type", { type: event.type })
        }
      } else {
        const subscriptionService = createSubscriptionService()
        await subscriptionService.handleWebhookEvent(event)
      }
    } catch (error) {
      // Processing failed: delete dedup record so Stripe can retry
      await stripeWebhookEventRepository.deleteEvent(event.id).catch((deleteErr) => {
        logger.error(
          "Failed to delete dedup record after processing error",
          deleteErr instanceof Error ? deleteErr : new Error(String(deleteErr)),
          { eventId: event.id }
        )
      })
      throw error
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error(
      "Stripe webhook error",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Webhook-hanteringsfel" },
      { status: 500 }
    )
  }
}
