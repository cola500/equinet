import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createStableInviteService } from "@/domain/stable/StableInviteServiceFactory"

type RouteContext = { params: Promise<{ token: string }> }

const ERROR_MESSAGES: Record<string, { message: string; status: number }> = {
  TOKEN_NOT_FOUND: { message: "Inbjudan hittades inte", status: 404 },
  TOKEN_EXPIRED: { message: "Inbjudan har gått ut", status: 410 },
  TOKEN_USED: { message: "Inbjudan har redan använts", status: 410 },
}

// GET - View invite info (public, no auth required)
export async function GET(request: NextRequest, context: RouteContext) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en minut." },
      { status: 429 }
    )
  }

  if (!(await isFeatureEnabled("stable_profiles"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  try {
    const { token } = await context.params

    const inviteService = createStableInviteService()
    const result = await inviteService.validateToken(token)

    if (result.isFailure) {
      const errorInfo = ERROR_MESSAGES[result.error] ?? {
        message: "Okänt fel",
        status: 500,
      }
      return NextResponse.json(
        { error: errorInfo.message, code: result.error },
        { status: errorInfo.status }
      )
    }

    const invite = result.value
    return NextResponse.json({
      stableName: invite.stableName,
      stableMunicipality: invite.stableMunicipality,
      email: invite.email,
      expiresAt: invite.expiresAt,
    })
  } catch (error) {
    logger.error("Failed to validate stable invite", error as Error)
    return NextResponse.json(
      { error: "Kunde inte hämta inbjudan" },
      { status: 500 }
    )
  }
}
