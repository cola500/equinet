/**
 * GET /api/native/announcements - Provider's route announcements for native iOS
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase)
 * Feature flag: route_planning (server-side gate)
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

export async function GET(request: NextRequest) {
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

    const announcements = await prisma.routeOrder.findMany({
      where: {
        providerId: provider.id,
        announcementType: "provider_announced",
      },
      select: {
        id: true,
        serviceType: true,
        municipality: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        specialInstructions: true,
        createdAt: true,
        routeStops: {
          select: {
            id: true,
            stopOrder: true,
            locationName: true,
            address: true,
          },
          orderBy: { stopOrder: "asc" },
        },
        services: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = announcements.map(({ _count, ...rest }) => ({
      ...rest,
      bookingCount: _count.bookings,
    }))

    logger.info("Native announcements fetched", {
      userId: authUser.id,
      providerId: provider.id,
      count: result.length,
    })

    return NextResponse.json({ announcements: result })
  } catch (error) {
    logger.error("Failed to fetch native announcements", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta annonser" },
      { status: 500 }
    )
  }
}
