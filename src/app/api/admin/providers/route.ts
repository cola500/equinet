import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: "För många förfrågningar" },
        { status: 429 }
      )
    }

    const session = await auth()
    await requireAdmin(session)

    const { searchParams } = new URL(request.url)
    const verified = searchParams.get("verified")
    const active = searchParams.get("active")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))

    const where: Record<string, unknown> = {}

    if (verified === "true") where.isVerified = true
    if (verified === "false") where.isVerified = false
    if (active === "true") where.isActive = true
    if (active === "false") where.isActive = false

    const [providersRaw, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        select: {
          id: true,
          businessName: true,
          city: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: { bookings: true, services: true },
          },
          reviews: {
            select: { rating: true },
          },
          fortnoxConnection: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.provider.count({ where }),
    ])

    const providers = providersRaw.map((p) => {
      const avgRating =
        p.reviews.length > 0
          ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
          : null

      return {
        id: p.id,
        businessName: p.businessName,
        city: p.city,
        isVerified: p.isVerified,
        isActive: p.isActive,
        createdAt: p.createdAt,
        bookingCount: p._count.bookings,
        serviceCount: p._count.services,
        averageRating: avgRating,
        hasFortnox: !!p.fortnoxConnection,
      }
    })

    return NextResponse.json({
      providers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    logger.error("Failed to fetch admin providers", error as Error)
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
