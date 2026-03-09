import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createStableService } from "@/domain/stable/StableServiceFactory"
import { createStableInviteService } from "@/domain/stable/StableInviteServiceFactory"

type RouteContext = { params: Promise<{ id: string }> }

// DELETE - Revoke a pending stable invite
export async function DELETE(request: NextRequest, context: RouteContext) {
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
    const { id } = await context.params

    // Verify user owns a stable
    const stableService = createStableService()
    const stable = await stableService.getByUserId(session.user.id)
    if (!stable) {
      return NextResponse.json(
        { error: "Du har inget stall" },
        { status: 403 }
      )
    }

    const inviteService = createStableInviteService()
    const revoked = await inviteService.revokeInvite(id, stable.id)

    if (!revoked) {
      return NextResponse.json(
        { error: "Inbjudan hittades inte eller har redan använts" },
        { status: 404 }
      )
    }

    logger.info("Stable invite revoked", { inviteId: id, stableId: stable.id })

    return NextResponse.json({ message: "Inbjudan återkallad" })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Failed to revoke stable invite", error as Error)
    return NextResponse.json(
      { error: "Kunde inte återkalla inbjudan" },
      { status: 500 }
    )
  }
}
