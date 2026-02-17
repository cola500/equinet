import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { startOfMonth, subMonths, format, getDay } from "date-fns"
import { sv } from "date-fns/locale"

/**
 * GET /api/provider/insights
 * Returns business insights: service breakdown, time heatmap, customer retention, KPIs
 * Query params: ?months=6 (3-12, default 6)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const ip = getClientIP(request)
    await rateLimiters.api(ip)

    const provider = await prisma.provider.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
    }

    // Parse and clamp months parameter
    const monthsParam = request.nextUrl.searchParams.get("months")
    const months = Math.min(12, Math.max(3, Number(monthsParam) || 6))

    const periodStart = subMonths(startOfMonth(new Date()), months - 1)

    // Fetch all bookings in period with select (never include)
    const bookings = await prisma.booking.findMany({
      where: {
        providerId: provider.id,
        bookingDate: { gte: periodStart },
      },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        status: true,
        customerId: true,
        isManualBooking: true,
        service: {
          select: { id: true, name: true, price: true },
        },
      },
    })

    const totalBookings = await prisma.booking.count({
      where: {
        providerId: provider.id,
        bookingDate: { gte: periodStart },
      },
    })

    // --- KPIs ---
    const completedBookings = bookings.filter((b) => b.status === "completed")
    const cancelledCount = bookings.filter((b) => b.status === "cancelled").length
    const noShowCount = bookings.filter((b) => b.status === "no_show").length
    const manualCount = bookings.filter((b) => b.isManualBooking).length

    const totalRevenue = completedBookings.reduce(
      (sum, b) => sum + (b.service?.price || 0),
      0
    )
    const uniqueCustomerIds = new Set(
      bookings.filter((b) => b.customerId).map((b) => b.customerId)
    )

    const kpis = {
      cancellationRate: totalBookings > 0 ? Math.round((cancelledCount / totalBookings) * 100) : 0,
      noShowRate: totalBookings > 0 ? Math.round((noShowCount / totalBookings) * 100) : 0,
      averageBookingValue:
        completedBookings.length > 0
          ? Math.round(totalRevenue / completedBookings.length)
          : 0,
      uniqueCustomers: uniqueCustomerIds.size,
      manualBookingRate:
        totalBookings > 0
          ? Math.round((manualCount / totalBookings) * 100)
          : 0,
    }

    // --- Service breakdown ---
    const serviceMap = new Map<
      string,
      { serviceName: string; count: number; revenue: number }
    >()
    for (const b of completedBookings) {
      if (!b.service) continue
      const existing = serviceMap.get(b.service.id)
      if (existing) {
        existing.count++
        existing.revenue += b.service.price || 0
      } else {
        serviceMap.set(b.service.id, {
          serviceName: b.service.name,
          count: 1,
          revenue: b.service.price || 0,
        })
      }
    }
    const serviceBreakdown = Array.from(serviceMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    )

    // --- Time heatmap ---
    // Days 0-6 (Sunday-Saturday) x hours
    const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"]
    const heatmapMap = new Map<string, number>()

    for (const b of bookings) {
      if (b.status === "cancelled") continue
      const date = new Date(b.bookingDate)
      const dayIndex = getDay(date)
      const hour = b.startTime ? parseInt(b.startTime.split(":")[0], 10) : null
      if (hour === null || isNaN(hour)) continue

      const key = `${dayIndex}-${hour}`
      heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1)
    }

    const timeHeatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
      const [dayIndex, hour] = key.split("-").map(Number)
      return {
        day: dayNames[dayIndex],
        dayIndex,
        hour,
        count,
      }
    })

    // --- Customer retention ---
    // For each month: count new customers vs returning customers
    const customerFirstSeen = new Map<string, Date>()
    for (const b of bookings) {
      if (!b.customerId || b.status === "cancelled") continue
      const existing = customerFirstSeen.get(b.customerId)
      const bookingDate = new Date(b.bookingDate)
      if (!existing || bookingDate < existing) {
        customerFirstSeen.set(b.customerId, bookingDate)
      }
    }

    const customerRetention = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = subMonths(startOfMonth(new Date()), i)
      const monthEnd = i > 0 ? subMonths(startOfMonth(new Date()), i - 1) : new Date()

      const monthBookings = bookings.filter((b) => {
        const d = new Date(b.bookingDate)
        return d >= monthStart && d < monthEnd && b.customerId && b.status !== "cancelled"
      })

      const monthCustomers = new Set(monthBookings.map((b) => b.customerId))
      let newCount = 0
      let returningCount = 0

      for (const cid of monthCustomers) {
        if (!cid) continue
        const firstSeen = customerFirstSeen.get(cid)
        if (firstSeen && firstSeen >= monthStart && firstSeen < monthEnd) {
          newCount++
        } else {
          returningCount++
        }
      }

      customerRetention.push({
        month: format(monthStart, "MMM", { locale: sv }),
        newCustomers: newCount,
        returningCustomers: returningCount,
      })
    }

    return NextResponse.json({
      serviceBreakdown,
      timeHeatmap,
      customerRetention,
      kpis,
    })
  } catch (error) {
    logger.error(
      "Error fetching provider insights",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
