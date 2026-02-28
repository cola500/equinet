import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"

/**
 * GET /api/provider/subscription/status
 * Returns current subscription status for the authenticated provider
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Auth (throws Response on unauthenticated)
    const session = await auth()
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }
    const providerId = session.user.providerId

    // 2. Rate limit (use 'api' limiter for reads)
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
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

    // 4. Service call - providerId from session, NEVER from request
    const service = createSubscriptionService()
    const result = await service.getStatus(providerId)

    if (!result.ok) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof Response) return error
    logger.error(
      "Error fetching subscription status",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
