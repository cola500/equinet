import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
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
export async function POST(request: NextRequest) {
  try {
    // 1. Auth (throws Response on unauthenticated)
    const session = await auth()
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }
    const providerId = session.user.providerId

    // 2. Rate limit
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.subscription(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    // 3. Feature flag
    if (!(await isFeatureEnabled("provider_subscription"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    // 4. Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    // 5. Validate
    const validated = checkoutSchema.parse(body)

    // 6. Service call - providerId from session, NEVER from request body
    const service = createSubscriptionService()
    const result = await service.initiateCheckout(
      providerId,
      validated.planId,
      validated.successUrl,
      validated.cancelUrl
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
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error(
      "Error initiating subscription checkout",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
