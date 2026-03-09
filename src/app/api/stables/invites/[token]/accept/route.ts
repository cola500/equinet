import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
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

// POST - Accept a stable invite (requires auth + email match)
export async function POST(request: NextRequest, context: RouteContext) {
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
    const session = await auth()
    const { token } = await context.params

    const inviteService = createStableInviteService()

    // Validate token first to get invite details (including email)
    const validation = await inviteService.validateToken(token)
    if (validation.isFailure) {
      const errorInfo = ERROR_MESSAGES[validation.error] ?? {
        message: "Okänt fel",
        status: 500,
      }
      return NextResponse.json(
        { error: errorInfo.message, code: validation.error },
        { status: errorInfo.status }
      )
    }

    // Verify email matches (case-insensitive)
    const invite = validation.value
    const sessionEmail = (session.user.email ?? "").toLowerCase()
    const inviteEmail = invite.email.toLowerCase()

    if (sessionEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: "Inbjudan tillhör en annan e-postadress. Logga in med rätt konto eller be stallägaren skicka en ny inbjudan.",
          code: "EMAIL_MISMATCH",
        },
        { status: 403 }
      )
    }

    // Email matches -- accept the invite
    const result = await inviteService.acceptInvite(token)
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

    logger.info("Stable invite accepted", {
      stableId: result.value.stableId,
      userId: session.user.id,
    })

    return NextResponse.json({
      stableId: result.value.stableId,
      stableName: result.value.stableName,
      message: "Inbjudan accepterad",
    })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Failed to accept stable invite", error as Error)
    return NextResponse.json(
      { error: "Kunde inte acceptera inbjudan" },
      { status: 500 }
    )
  }
}
