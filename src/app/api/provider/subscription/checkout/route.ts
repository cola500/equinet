import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { z } from "zod"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"

const checkoutSchema = z.object({
  planId: z.string().min(1, "Ogiltig plan"),
  successUrl: z.string().url("Ogiltig URL"),
  cancelUrl: z.string().url("Ogiltig URL"),
}).strict()

/**
 * POST /api/provider/subscription/checkout
 * Initiates a Stripe checkout session for provider subscription
 */
export const POST = withApiHandler(
  { auth: "provider", rateLimit: "subscription", featureFlag: "provider_subscription", schema: checkoutSchema },
  async ({ user, body }) => {
    const service = createSubscriptionService()
    const result = await service.initiateCheckout(
      user.providerId,
      body.planId,
      body.successUrl,
      body.cancelUrl
    )

    if (!result.ok) {
      if (result.error === "FEATURE_DISABLED") {
        return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
      }
      if (result.error === "ALREADY_SUBSCRIBED") {
        return NextResponse.json(
          { error: "Du har redan en aktiv prenumeration" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
    }

    return NextResponse.json({ checkoutUrl: result.value.checkoutUrl })
  },
)
