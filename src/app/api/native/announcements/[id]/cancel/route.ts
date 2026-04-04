/**
 * POST /api/native/announcements/[id]/cancel - Cancel a provider announcement
 *
 * Auth: Bearer > Supabase
 * Feature flag: route_planning (server-side gate)
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    try {
      const clientIP = getClientIP(request)
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar, försök igen senare" },
          { status: 429 }
        )
      }
    } catch (error) {
      if (error instanceof RateLimitServiceError) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt otillgänglig" },
          { status: 503 }
        )
      }
      throw error
    }

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    const { id } = await params

    const announcement = await prisma.routeOrder.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        announcementType: true,
        status: true,
      },
    })

    if (!announcement || announcement.announcementType !== "provider_announced") {
      return NextResponse.json(
        { error: "Annons hittades inte" },
        { status: 404 }
      )
    }

    if (announcement.providerId !== provider.id) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    if (announcement.status !== "open") {
      return NextResponse.json(
        { error: "Bara öppna annonser kan avbrytas" },
        { status: 400 }
      )
    }

    await prisma.routeOrder.update({
      where: { id },
      data: { status: "cancelled" },
    })

    logger.info("Native announcement cancelled", {
      userId: authUser.id,
      providerId: provider.id,
      announcementId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("Failed to cancel native announcement", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte avbryta annons" },
      { status: 500 }
    )
  }
}
