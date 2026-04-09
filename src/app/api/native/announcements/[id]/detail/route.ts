/**
 * GET /api/native/announcements/[id]/detail - Announcement detail with bookings
 *
 * Auth: Bearer > Supabase
 * Feature flag: route_announcements
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIP = getClientIP(request)
    try {
      const isAllowed = await rateLimiters.api(clientIP)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar" },
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

    if (!(await isFeatureEnabled("route_announcements"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    if (!authUser.providerId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    const { id: announcementId } = await params

    // Fetch announcement with ownership check
    const announcement = await prisma.routeOrder.findFirst({
      where: {
        id: announcementId,
        providerId: authUser.providerId,
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
        services: {
          select: { id: true, name: true },
        },
      },
    })

    if (!announcement) {
      return NextResponse.json(
        { error: "Annons hittades inte" },
        { status: 404 }
      )
    }

    // Fetch bookings
    const bookings = await prisma.booking.findMany({
      where: { routeOrderId: announcementId },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        horseName: true,
        customerNotes: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    })

    const result = {
      announcement,
      bookings: bookings.map(b => ({
        id: b.id,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        horseName: b.horseName,
        customerNotes: b.customerNotes,
        customerName: `${b.customer.firstName} ${b.customer.lastName}`,
        customerPhone: b.customer.phone,
        serviceName: b.service?.name,
        servicePrice: b.service?.price,
      })),
      summary: {
        total: bookings.length,
        pending: bookings.filter(b => b.status === "pending").length,
        confirmed: bookings.filter(b => b.status === "confirmed").length,
      },
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error("Failed to fetch announcement detail", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta annonsdetaljer" },
      { status: 500 }
    )
  }
}
