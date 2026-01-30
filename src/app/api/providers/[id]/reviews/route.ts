import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// GET - Public endpoint: fetch reviews for a provider with pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: providerId } = await params

    // Check provider exists
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Parse pagination params
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")))
    const skip = (page - 1) * limit

    // Fetch reviews, count, and average in parallel
    const [reviews, totalCount, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { providerId },
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
            select: {
              firstName: true,
              lastName: true,
            },
          },
          booking: {
            select: {
              service: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.review.count({ where: { providerId } }),
      prisma.review.aggregate({
        where: { providerId },
        _avg: { rating: true },
      }),
    ])

    return NextResponse.json({
      reviews,
      totalCount,
      averageRating: aggregate._avg.rating,
      page,
      limit,
    })
  } catch (error) {
    logger.error("Error fetching provider reviews", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    )
  }
}
