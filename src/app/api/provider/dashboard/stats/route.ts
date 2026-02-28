import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { getCachedDashboardStats, setCachedDashboardStats } from "@/lib/cache/provider-stats-cache"
import {
  startOfWeek,
  subWeeks,
  startOfMonth,
  subMonths,
  format,
  getISOWeek,
} from "date-fns"
import { sv } from "date-fns/locale"

/**
 * GET /api/provider/dashboard/stats
 * Returns booking trend (8 weeks) and revenue trend (6 months) for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const ip = getClientIP(request)
    const isAllowed = await rateLimiters.api(ip)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const provider = await prisma.provider.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // Check cache
    const cached = await getCachedDashboardStats(provider.id)
    if (cached) {
      return NextResponse.json(cached)
    }

    const now = new Date()
    const eightWeeksAgo = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 7)

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        status: { in: ["completed", "cancelled"] },
        bookingDate: { gte: eightWeeksAgo },
      },
      select: {
        bookingDate: true,
        status: true,
        service: {
          select: { price: true },
        },
      },
    })

    // Build 8-week booking trend
    const bookingTrend = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), i)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekBookings = bookings.filter((b) => {
        const date = new Date(b.bookingDate)
        return date >= weekStart && date < weekEnd
      })

      bookingTrend.push({
        week: `v.${getISOWeek(weekStart)}`,
        completed: weekBookings.filter((b) => b.status === "completed").length,
        cancelled: weekBookings.filter((b) => b.status === "cancelled").length,
      })
    }

    // Build 6-month revenue trend
    const revenueTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(startOfMonth(now), i)
      const monthEnd = subMonths(startOfMonth(now), i - 1)

      const monthBookings = bookings.filter((b) => {
        const date = new Date(b.bookingDate)
        return date >= monthStart && date < monthEnd && b.status === "completed"
      })

      const revenue = monthBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0)

      revenueTrend.push({
        month: format(monthStart, "MMM", { locale: sv }),
        revenue,
      })
    }

    const responseData = { bookingTrend, revenueTrend }

    // Store in cache (fire-and-forget)
    setCachedDashboardStats(provider.id, responseData).catch(() => {})

    return NextResponse.json(responseData)
  } catch (error) {
    logger.error("Error fetching dashboard stats", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
