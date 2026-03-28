import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { z } from "zod"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"

const portalSchema = z
  .object({
    returnUrl: z.string().url("Ogiltig URL"),
  })
  .strict()

export const POST = withApiHandler(
  { auth: "provider", rateLimit: "subscription", featureFlag: "provider_subscription", schema: portalSchema },
  async ({ user, body }) => {
    const service = createSubscriptionService()
    const result = await service.getPortalUrl(
      user.providerId,
      body.returnUrl
    )

    if (!result.ok) {
      if (result.error === "FEATURE_DISABLED") {
        return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
      }
      if (result.error === "NO_SUBSCRIPTION") {
        return NextResponse.json(
          { error: "Ingen aktiv prenumeration" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Internt serverfel" },
        { status: 500 }
      )
    }

    return NextResponse.json({ portalUrl: result.value.portalUrl })
  },
)
