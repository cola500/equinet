/**
 * GET /api/widget/next-booking - Next upcoming booking for widget
 *
 * Auth: Bearer token (mobile token).
 * Returns minimal booking data for iOS widget display.
 */
import { NextRequest, NextResponse } from "next/server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    // Auth (Bearer token)
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // Find next upcoming booking for this provider
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    logger.info("Widget next-booking query", {
      userId: authResult.userId,
      today: today.toISOString(),
    })

    const booking = await prisma.booking.findFirst({
      where: {
        provider: { userId: authResult.userId },
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
