/**
 * GET /api/native/dashboard - Dashboard data for native iOS app
 *
 * Auth: Bearer token (mobile token).
 * Returns KPI stats, today's bookings, onboarding status, and priority action.
 */
import { NextRequest, NextResponse } from "next/server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { startOfDay, endOfDay } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (Bearer token)
    const authResult = await authFromMobileToken(request)
    if (!authResult) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting
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

    // 3. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authResult.userId },
      select: {
        id: true,
        businessName: true,
        description: true,
        address: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        isActive: true,
        services: {
          where: { isActive: true },
          select: { id: true },
        },
        availability: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    })

    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Calculate today boundaries (server-side, CET in fra1)
    const now = new Date()
    const startOfToday = startOfDay(now)
    const endOfToday = endOfDay(now)

    // 5. Fetch data in parallel
    const [todayBookingsRaw, upcomingBookingsRaw, reviewAgg] = await Promise.all([
      // Today's bookings (confirmed + pending, max 10)
      prisma.booking.findMany({
        where: {
          providerId: provider.id,
          bookingDate: { gte: startOfToday, lte: endOfToday },
          status: { in: ["confirmed", "pending"] },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          customer: {
            select: { firstName: true, lastName: true },
          },
          service: {
            select: { name: true },
          },
        },
        orderBy: { startTime: "asc" },
        take: 10,
      }),

      // Upcoming bookings (from today forward) for counts
      prisma.booking.findMany({
        where: {
          providerId: provider.id,
          status: { in: ["pending", "confirmed"] },
          bookingDate: { gte: startOfToday },
        },
        select: { status: true },
      }),

      // Review stats
      prisma.customerReview.aggregate({
        where: { providerId: provider.id },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ])

    // 6. Map today bookings
    const todayBookings = todayBookingsRaw.map((b) => ({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      customerFirstName: b.customer.firstName,
      customerLastName: b.customer.lastName,
      serviceName: b.service.name,
      status: b.status,
    }))

    // 7. Calculate KPI counts
    const todayBookingCount = todayBookingsRaw.filter(
      (b) => b.status === "confirmed"
    ).length
    const upcomingBookingCount = upcomingBookingsRaw.length
    const pendingBookingCount = upcomingBookingsRaw.filter(
      (b) => b.status === "pending"
    ).length

    // 8. Review stats
    const reviewStats = {
      averageRating: reviewAgg._avg.rating ?? null,
      totalCount: reviewAgg._count._all,
    }

    // 9. Onboarding status
    const profileComplete = Boolean(
      provider.businessName &&
      provider.description &&
      provider.address &&
      provider.city &&
      provider.postalCode &&
      provider.latitude !== null &&
      provider.longitude !== null
    )
    const hasServices = provider.services.length > 0
    const hasAvailability = provider.availability.length > 0
    const isActive = provider.isActive
    const allComplete = profileComplete && hasServices && hasAvailability && isActive

    const onboarding = {
      profileComplete,
      hasServices,
      hasAvailability,
      isActive,
      allComplete,
    }

    // 10. Priority action (pending > onboarding > none)
    let priorityAction: {
      type: string
      count?: number
      label: string
    }

    if (pendingBookingCount > 0) {
      priorityAction = {
        type: "pending_bookings",
        count: pendingBookingCount,
        label: pendingBookingCount === 1
          ? "1 ny förfrågan väntar"
          : `${pendingBookingCount} nya förfrågningar väntar`,
      }
    } else if (!allComplete) {
      priorityAction = {
        type: "incomplete_onboarding",
        label: "Slutför din profil för att bli synlig",
      }
    } else {
      priorityAction = {
        type: "none",
        label: "",
      }
    }

    logger.info("Native dashboard data fetched", {
      userId: authResult.userId,
      providerId: provider.id,
      todayBookings: todayBookings.length,
      upcomingCount: upcomingBookingCount,
      pendingCount: pendingBookingCount,
    })

    return NextResponse.json({
      todayBookings,
      todayBookingCount,
      upcomingBookingCount,
      pendingBookingCount,
      reviewStats,
      onboarding,
      priorityAction,
    })
  } catch (error) {
    logger.error("Failed to fetch native dashboard data", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
