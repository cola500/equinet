import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { getCachedProviderInsights, setCachedProviderInsights } from "@/lib/cache/provider-stats-cache"
import { startOfMonth, subMonths, format, getDay } from "date-fns"
import { sv } from "date-fns/locale"

type BookingForKpis = {
  status: string
  isManualBooking: boolean
  customerId: string | null
  service: { price: number | null } | null
}

function calculateKpis(bookings: BookingForKpis[]) {
  const total = bookings.length
  const completed = bookings.filter((b) => b.status === "completed")
  const cancelled = bookings.filter((b) => b.status === "cancelled").length
  const noShow = bookings.filter((b) => b.status === "no_show").length
  const manual = bookings.filter((b) => b.isManualBooking).length

  const revenue = completed.reduce(
    (sum, b) => sum + (b.service?.price || 0),
    0
  )
  const uniqueIds = new Set(
    bookings.filter((b) => b.customerId).map((b) => b.customerId)
  )

  return {
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    totalRevenue: Math.round(revenue),
    averageBookingValue:
      completed.length > 0 ? Math.round(revenue / completed.length) : 0,
    uniqueCustomers: uniqueIds.size,
    manualBookingRate:
      total > 0 ? Math.round((manual / total) * 100) : 0,
  }
}

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

    if (!session.user.providerId) {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
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

    // Parse and clamp months parameter
    const monthsParam = request.nextUrl.searchParams.get("months")
    const months = Math.min(12, Math.max(3, Number(monthsParam) || 6))

    // Check cache
    const cached = await getCachedProviderInsights(provider.id, months)
    if (cached) {
      return NextResponse.json(cached)
    }

    const periodStart = subMonths(startOfMonth(new Date()), months - 1)
    const previousPeriodStart = subMonths(periodStart, months)

    const bookingSelect = {
      id: true,
      bookingDate: true,
      startTime: true,
      status: true,
      customerId: true,
      isManualBooking: true,
      service: {
        select: { id: true, name: true, price: true },
      },
    } as const

    const [bookings, previousBookings] = await Promise.all([
      prisma.booking.findMany({
        where: {
          providerId: provider.id,
          bookingDate: { gte: periodStart },
        },
        select: bookingSelect,
      }),
      prisma.booking.findMany({
        where: {
          providerId: provider.id,
          bookingDate: { gte: previousPeriodStart, lt: periodStart },
        },
        select: bookingSelect,
      }),
    ])

    const completedBookings = bookings.filter((b) => b.status === "completed")
    const kpis = calculateKpis(bookings)
    const previousKpis = calculateKpis(previousBookings)
    const hasPreviousPeriod = previousBookings.length > 0

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
      // Parse as local date to avoid UTC midnight shifting the day index
      const dateStr = b.bookingDate.toISOString().split("T")[0]
      const [y, mo, d] = dateStr.split("-").map(Number)
      const dayIndex = getDay(new Date(y, mo - 1, d))
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

    const responseData = {
      serviceBreakdown,
      timeHeatmap,
      customerRetention,
      kpis,
      previousKpis,
      hasPreviousPeriod,
    }

    // Store in cache (fire-and-forget)
    setCachedProviderInsights(provider.id, months, responseData).catch(() => {})

    return NextResponse.json(responseData)
  } catch (error) {
    logger.error(
      "Error fetching provider insights",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  }
}
