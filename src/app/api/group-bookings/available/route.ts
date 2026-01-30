import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

/**
 * GET /api/group-bookings/available
 * Returns open group booking requests visible to the authenticated provider.
 * Optionally filtered by service type matching provider's services.
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "För många förfrågningar." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantörer kan se tillgängliga grupprequests" },
        { status: 403 }
      )
    }

    // Get provider with their services to match service types
    const provider = await prisma.provider.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        serviceAreaKm: true,
        services: {
          where: { isActive: true },
          select: { name: true },
        },
      },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Provider hittades inte" },
        { status: 404 }
      )
    }

    // Fetch open group requests, ordered by date
    const groupRequests = await prisma.groupBookingRequest.findMany({
      where: {
        status: "open",
        dateFrom: { gte: new Date() }, // Only future requests
      },
      include: {
        participants: {
          where: { status: { not: "cancelled" } },
          include: {
            user: {
              select: { firstName: true },
            },
          },
        },
        _count: {
          select: { participants: { where: { status: { not: "cancelled" } } } },
        },
      },
      orderBy: { dateFrom: "asc" },
    })

    // TODO: Add geo-filtering when lat/lng is available on requests
    // For now, return all open requests

    return NextResponse.json(groupRequests)
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    logger.error("Failed to fetch available group bookings", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Failed to fetch available group bookings" },
      { status: 500 }
    )
  }
}
