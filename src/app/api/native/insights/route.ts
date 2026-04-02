/**
 * GET /api/native/insights - Business insights for native iOS
 *
 * Auth: Bearer token (mobile token).
 * Feature flag: business_insights (server-side gate, defense in depth)
 */
import { NextRequest, NextResponse } from "next/server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { startOfMonth, subMonths, format, getDay } from "date-fns"
import { sv } from "date-fns/locale"

export async function GET(request: NextRequest) {
  try {
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
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

    if (!(await isFeatureEnabled("business_insights"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const provider = await prisma.provider.findUnique({
      where: { userId: authResult.userId },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    const monthsParam = request.nextUrl.searchParams.get("months")
    const months = Math.min(12, Math.max(3, Number(monthsParam) || 6))

    const periodStart = subMonths(startOfMonth(new Date()), months - 1)

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

    const totalBookings = bookings.length

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

    logger.info("Native insights fetched", {
      userId: authResult.userId,
      providerId: provider.id,
      months,
      bookingCount: totalBookings,
    })

    return NextResponse.json({
      serviceBreakdown,
      timeHeatmap,
      customerRetention,
      kpis,
    })
  } catch (error) {
    logger.error("Failed to fetch native insights", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Kunde inte hämta insikter" },
      { status: 500 }
    )
  }
}
