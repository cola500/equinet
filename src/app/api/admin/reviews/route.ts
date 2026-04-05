import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"

export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const search = searchParams.get("search") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))

    const searchWhere = search
      ? { comment: { contains: search, mode: "insensitive" as const } }
      : {}

    const includeReviews = type === "all" || type === "review"
    const includeCustomerReviews = type === "all" || type === "customerReview"

    const [reviews, reviewCount, customerReviews, customerReviewCount] = await Promise.all([
      includeReviews
        ? prisma.review.findMany({
            where: searchWhere,
            select: {
              id: true,
              rating: true,
              comment: true,
              reply: true,
              createdAt: true,
              customer: { select: { firstName: true, lastName: true } },
              provider: { select: { businessName: true } },
              booking: { select: { bookingDate: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
          })
        : [],
      includeReviews ? prisma.review.count({ where: searchWhere }) : 0,
      includeCustomerReviews
        ? prisma.customerReview.findMany({
            where: searchWhere,
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              customer: { select: { firstName: true, lastName: true } },
              provider: { select: { businessName: true } },
              booking: { select: { bookingDate: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
          })
        : [],
      includeCustomerReviews
        ? prisma.customerReview.count({ where: searchWhere })
        : 0,
    ])

    type ReviewRow = (typeof reviews)[number]
    type CustomerReviewRow = (typeof customerReviews)[number]

    const merged = [
      ...reviews.map((r: ReviewRow) => ({
        id: r.id,
        type: "review" as const,
        rating: r.rating,
        comment: r.comment,
        reply: r.reply || null,
        customerName: [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(" ") || "-",
        providerBusinessName: r.provider?.businessName || "-",
        bookingDate: r.booking?.bookingDate,
        createdAt: r.createdAt,
      })),
      ...customerReviews.map((r: CustomerReviewRow) => ({
        id: r.id,
        type: "customerReview" as const,
        rating: r.rating,
        comment: r.comment,
        reply: null,
        customerName: [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(" ") || "-",
        providerBusinessName: r.provider?.businessName || "-",
        bookingDate: r.booking?.bookingDate,
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = reviewCount + customerReviewCount
    const startIdx = (page - 1) * limit
    const paged = merged.slice(startIdx, startIdx + limit)

    return NextResponse.json({
      reviews: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  },
)
