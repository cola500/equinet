import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

/**
 * GET /api/providers/[id]/upcoming-routes
 *
 * Returns up to 3 upcoming provider-announced route orders for a specific provider.
 * No auth required — complements the public provider profile page.
 * Visible to all visitors regardless of GPS permission.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("route_planning"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { id: providerId } = await params

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcomingRoutes = await prisma.routeOrder.findMany({
      where: {
        providerId,
        announcementType: "provider_announced",
        status: "open",
        dateFrom: { gte: today },
      },
      select: {
        id: true,
        dateFrom: true,
        dateTo: true,
        municipality: true,
        serviceType: true,
      },
      orderBy: { dateFrom: "asc" },
      take: 3,
    })

    return NextResponse.json(upcomingRoutes)
  } catch (error) {
    logger.error(
      "Error fetching upcoming routes for provider",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
