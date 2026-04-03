/**
 * GET /api/native/reviews - Review list for native iOS app
 *
 * Auth: Dual-auth (Bearer > NextAuth > Supabase).
 * Returns paginated reviews for the provider with average rating.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    // 1. Auth (dual-auth)
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    // 2. Rate limiting (fail-closed)
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

    // 3. Parse query params with clamping
    const pageParam = parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
    const limitParam = parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10)
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const limit = Math.min(50, Math.max(1, isNaN(limitParam) ? 10 : limitParam))
    const skip = (page - 1) * limit

    // 4. Find provider
    const provider = await prisma.provider.findUnique({
      where: { userId: authUser.id },
      select: { id: true },
    })
    if (!provider) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // 5. Fetch reviews, count, and average in parallel
    const where = { providerId: provider.id }

    const [reviews, totalCount, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          rating: true,
          comment: true,
          reply: true,
          repliedAt: true,
          createdAt: true,
          customer: {
            select: { firstName: true, lastName: true },
          },
          booking: {
            select: { service: { select: { name: true } } },
          },
        },
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),
    ])

    logger.info("Native reviews fetched", {
      userId: authUser.id,
      providerId: provider.id,
      count: reviews.length,
      totalCount,
      page,
    })

    // 6. Flatten response (lean -- no sensitive IDs)
    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment ?? null,
        reply: r.reply ?? null,
        repliedAt: r.repliedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        customerName: `${r.customer.firstName} ${r.customer.lastName}`,
        serviceName: r.booking.service?.name ?? null,
      })),
      totalCount,
      averageRating: aggregate._avg.rating ?? null,
      page,
      limit,
    })
  } catch (error) {
    logger.error("Failed to fetch native reviews", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
