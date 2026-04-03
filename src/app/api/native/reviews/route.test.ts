/**
 * GET /api/native/reviews tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    review: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindReviews = vi.mocked(prisma.review.findMany)
const mockCountReviews = vi.mocked(prisma.review.count)
const mockAggregateReviews = vi.mocked(prisma.review.aggregate)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(params?: { page?: string; limit?: string }) {
  const url = new URL("http://localhost:3000/api/native/reviews")
  if (params?.page) url.searchParams.set("page", params.page)
  if (params?.limit) url.searchParams.set("limit", params.limit)
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

const mockProvider = { id: "provider-1" }

const mockReview = {
  id: "review-1",
  rating: 5,
  comment: "Fantastisk hovslagare!",
  reply: "Tack så mycket!",
  repliedAt: new Date("2026-03-10T14:30:00Z"),
  createdAt: new Date("2026-03-08T09:15:00Z"),
  customer: { firstName: "Anna", lastName: "Andersson" },
  booking: { service: { name: "Hovverkning" } },
}

describe("GET /api/native/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "bearer" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockFindReviews.mockResolvedValue([mockReview] as never)
    mockCountReviews.mockResolvedValue(1)
    mockAggregateReviews.mockResolvedValue({ _avg: { rating: 5 } } as never)
    mockRateLimit.mockResolvedValue(true)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await GET(createRequest())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe("Tjänsten är tillfälligt otillgänglig")
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns reviews with correct pagination and averageRating", async () => {
    mockCountReviews.mockResolvedValue(12)
    mockAggregateReviews.mockResolvedValue({ _avg: { rating: 4.5 } } as never)

    const res = await GET(createRequest({ page: "1", limit: "10" }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.totalCount).toBe(12)
    expect(body.averageRating).toBe(4.5)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(10)
    expect(body.reviews).toHaveLength(1)

    const r = body.reviews[0]
    expect(r.id).toBe("review-1")
    expect(r.rating).toBe(5)
    expect(r.comment).toBe("Fantastisk hovslagare!")
    expect(r.reply).toBe("Tack så mycket!")
    expect(r.repliedAt).toBe("2026-03-10T14:30:00.000Z")
    expect(r.createdAt).toBe("2026-03-08T09:15:00.000Z")
    expect(r.customerName).toBe("Anna Andersson")
    expect(r.serviceName).toBe("Hovverkning")
  })

  it("returns empty state with averageRating null", async () => {
    mockFindReviews.mockResolvedValue([])
    mockCountReviews.mockResolvedValue(0)
    mockAggregateReviews.mockResolvedValue({ _avg: { rating: null } } as never)

    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.reviews).toEqual([])
    expect(body.totalCount).toBe(0)
    expect(body.averageRating).toBeNull()
    expect(body.page).toBe(1)
    expect(body.limit).toBe(10)
  })

  it("clamps limit to 50 when exceeding", async () => {
    const res = await GET(createRequest({ limit: "100" }))
    expect(res.status).toBe(200)

    // Verify the Prisma call used take: 50
    expect(mockFindReviews).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it("does not expose sensitive fields (customerId, providerId, bookingId)", async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    const r = body.reviews[0]

    expect(r).not.toHaveProperty("customerId")
    expect(r).not.toHaveProperty("providerId")
    expect(r).not.toHaveProperty("bookingId")
    expect(r).not.toHaveProperty("customer")
    expect(r).not.toHaveProperty("booking")
  })

  it("uses default page=1 and limit=10 when not specified", async () => {
    await GET(createRequest())

    expect(mockFindReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      })
    )
  })

  it("handles review with null reply", async () => {
    mockFindReviews.mockResolvedValue([{
      ...mockReview,
      reply: null,
      repliedAt: null,
    }] as never)

    const res = await GET(createRequest())
    const body = await res.json()
    const r = body.reviews[0]

    expect(r.reply).toBeNull()
    expect(r.repliedAt).toBeNull()
  })

  it("returns 500 on unexpected error", async () => {
    mockFindReviews.mockRejectedValue(new Error("DB error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
