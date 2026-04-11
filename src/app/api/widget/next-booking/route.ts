/**
 * GET /api/widget/next-booking - Next upcoming booking for widget
 *
 * Auth: Supabase Auth (cookie or Bearer via getAuthUser).
 * Returns minimal booking data for iOS widget display.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Rate limiting (after auth to avoid leaking auth state via 429)
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    // Find next upcoming booking for this provider
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    logger.info("Widget next-booking query", {
      userId: authUser.id,
      today: today.toISOString(),
    })

    const booking = await prisma.booking.findFirst({
      where: {
        provider: { userId: authUser.id },
        bookingDate: { gte: today },
        status: { in: ["confirmed", "pending"] },
      },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        horseName: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
      },
    })

    logger.info("Widget next-booking result", {
      found: !!booking,
      bookingId: booking?.id ?? null,
    })

    return NextResponse.json({
      booking: booking ?? null,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error("Failed to fetch next booking for widget", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
