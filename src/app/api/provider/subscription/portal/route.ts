import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createSubscriptionService } from "@/domain/subscription/SubscriptionServiceFactory"

const portalSchema = z
  .object({
    returnUrl: z.string().url("Ogiltig URL"),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }
    const providerId = session.user.providerId

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.subscription(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    if (!(await isFeatureEnabled("provider_subscription"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = portalSchema.parse(body)

    const service = createSubscriptionService()
    const result = await service.getPortalUrl(
      providerId,
      validated.returnUrl
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
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }
    logger.error(
      "Error creating portal session",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
