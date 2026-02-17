import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

/**
 * GET /api/customer/onboarding-status
 * Returns onboarding completion status for the current customer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const ip = getClientIP(request)
    await rateLimiters.api(ip)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        horses: {
          select: { id: true },
          take: 1,
        },
        bookings: {
          select: { id: true },
          take: 1,
        },
        reviews: {
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Användare hittades inte" }, { status: 404 })
    }

    const profileComplete = Boolean(user.firstName && user.lastName && user.phone)
    const hasHorses = user.horses.length > 0
    const hasBookings = user.bookings.length > 0
    const hasReviews = user.reviews.length > 0
    const allComplete = profileComplete && hasHorses && hasBookings && hasReviews

    return NextResponse.json({
      profileComplete,
      hasHorses,
      hasBookings,
      hasReviews,
      allComplete,
    })
  } catch (error) {
    logger.error("Error fetching customer onboarding status", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
