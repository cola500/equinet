import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { getSubscriptionGateway } from "@/domain/subscription/SubscriptionGateway"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"

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

    const service = createSubscriptionService()
    await service.handleWebhookEvent(event)

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
