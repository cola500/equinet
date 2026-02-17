import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { ProviderRepository } from "@/infrastructure/persistence/provider/ProviderRepository"
import { hasCustomerRelationship } from "@/lib/customer-relationship"
import {
  CustomerInsightService,
  mapInsightErrorToStatus,
  type CustomerDataContext,
  type CustomerMetrics,
} from "@/domain/customer-insight/CustomerInsightService"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
  getCachedInsight,
  setCachedInsight,
} from "@/lib/cache/customer-insights-cache"

type RouteContext = { params: Promise<{ customerId: string }> }

/**
 * POST /api/provider/customers/[customerId]/insights
 *
 * Generates AI-powered customer insights based on booking history,
 * notes, reviews, and horses.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Auth
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    if (session.user.userType !== "provider") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    // 2. Rate limit (AI-specific)
    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.ai(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många AI-förfrågningar. Försök igen om en stund." },
        { status: 429 }
      )
    }

    // 3. Get provider
    const providerRepo = new ProviderRepository()
    const provider = await providerRepo.findByUserId(session.user.id)
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 4. Verify customer relationship
    const { customerId } = await context.params
    const hasRelation = await hasCustomerRelationship(provider.id, customerId)
    if (!hasRelation) {
      return NextResponse.json(
        { error: "Ingen kundrelation hittades" },
        { status: 403 }
      )
    }

    // 5. Check cache (skip if force refresh)
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get("refresh") === "true"

    if (!forceRefresh) {
      const cached = await getCachedInsight(provider.id, customerId)
      if (cached) {
        return NextResponse.json({
          insight: cached.insight,
          metrics: cached.metrics,
          cached: true,
          cachedAt: cached.cachedAt,
        })
      }
    }

    // 6. Fetch data (4 parallel queries)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const [bookings, notes, reviews, customerReviews] = await Promise.all([
      prisma.booking.findMany({
        where: {
          providerId: provider.id,
          customerId,
          bookingDate: { gte: twelveMonthsAgo },
        },
        select: {
          bookingDate: true,
          startTime: true,
          status: true,
          providerNotes: true,
          cancellationMessage: true,
          service: { select: { name: true, price: true } },
          horse: { select: { name: true, breed: true, specialNeeds: true } },
        },
        orderBy: { bookingDate: "desc" },
      }),
      prisma.providerCustomerNote.findMany({
        where: { providerId: provider.id, customerId },
        select: { content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.findMany({
        where: { customerId, providerId: provider.id },
        select: { rating: true, comment: true },
      }),
      prisma.customerReview.findMany({
        where: { customerId, providerId: provider.id },
        select: { rating: true, comment: true },
      }),
    ])

    // 6. Build context and calculate metrics
    const dataContext: CustomerDataContext = {
      bookings: bookings.map((b) => ({
        bookingDate: b.bookingDate.toISOString().split("T")[0],
        startTime: b.startTime,
        status: b.status,
        serviceName: b.service.name,
        servicePrice: b.service.price,
        horseName: b.horse?.name ?? null,
        providerNotes: b.providerNotes,
        cancellationMessage: b.cancellationMessage,
      })),
      notes: notes.map((n) => ({
        content: n.content,
        createdAt: n.createdAt.toISOString().split("T")[0],
      })),
      reviews: reviews.map((r) => ({
        rating: r.rating,
        comment: r.comment,
      })),
      customerReviews: customerReviews.map((r) => ({
        rating: r.rating,
        comment: r.comment,
      })),
      horses: extractUniqueHorses(bookings),
    }

    const metrics = calculateMetrics(bookings)

    // 7. Generate insight
    const service = new CustomerInsightService()
    const result = await service.generateInsight(dataContext, metrics)

    if (result.isFailure) {
      const statusCode = mapInsightErrorToStatus(result.error)
      return NextResponse.json(
        { error: result.error.message },
        { status: statusCode }
      )
    }

    // Store in cache (fire-and-forget)
    setCachedInsight(provider.id, customerId, {
      insight: result.value,
      metrics,
    })

    logger.info("Customer insight generated", {
      providerId: provider.id,
      customerId,
      vipScore: result.value.vipScore,
    })

    return NextResponse.json({
      insight: result.value,
      metrics,
    })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Error generating customer insight",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

interface BookingRow {
  bookingDate: Date
  startTime: string
  status: string
  providerNotes: string | null
  cancellationMessage: string | null
  service: { name: string; price: number }
  horse: { name: string; breed: string | null; specialNeeds: string | null } | null
}

function calculateMetrics(bookings: BookingRow[]): CustomerMetrics {
  const completed = bookings.filter((b) => b.status === "completed")
  const cancelled = bookings.filter((b) => b.status === "cancelled")
  const noShow = bookings.filter((b) => b.status === "no_show")
  const totalSpent = completed.reduce((sum, b) => sum + b.service.price, 0)

  const sortedDates = completed
    .map((b) => b.bookingDate.getTime())
    .sort((a, b) => a - b)

  let avgInterval: number | null = null
  if (sortedDates.length > 1) {
    const intervals: number[] = []
    for (let i = 1; i < sortedDates.length; i++) {
      intervals.push(
        Math.round((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24))
      )
    }
    avgInterval = Math.round(
      intervals.reduce((a, b) => a + b, 0) / intervals.length
    )
  }

  return {
    totalBookings: bookings.length,
    completedBookings: completed.length,
    cancelledBookings: cancelled.length,
    noShowBookings: noShow.length,
    totalSpent,
    avgBookingIntervalDays: avgInterval,
    lastBookingDate:
      bookings.length > 0
        ? bookings[0].bookingDate.toISOString().split("T")[0]
        : null,
    firstBookingDate:
      bookings.length > 0
        ? bookings[bookings.length - 1].bookingDate.toISOString().split("T")[0]
        : null,
  }
}

function extractUniqueHorses(
  bookings: BookingRow[]
): Array<{ name: string; breed: string | null; specialNeeds: string | null }> {
  const seen = new Map<
    string,
    { name: string; breed: string | null; specialNeeds: string | null }
  >()
  for (const b of bookings) {
    if (b.horse && !seen.has(b.horse.name)) {
      seen.set(b.horse.name, {
        name: b.horse.name,
        breed: b.horse.breed,
        specialNeeds: b.horse.specialNeeds,
      })
    }
  }
  return Array.from(seen.values())
}
