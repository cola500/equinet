import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"

/**
 * GET /api/provider/subscription/status
 * Returns current subscription status for the authenticated provider
 */
export const GET = withApiHandler(
  { auth: "provider", featureFlag: "provider_subscription" },
  async ({ user }) => {
    const service = createSubscriptionService()
    const result = await service.getStatus(user.providerId)

    if (!result.ok) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    return NextResponse.json(result.value)
  },
)
