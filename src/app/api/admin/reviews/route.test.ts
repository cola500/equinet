import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    review: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    customerReview: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}))

import { GET } from "./route"
import { prisma } from "@/lib/prisma"

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

describe("GET /api/admin/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
  })

  it("should return merged and paginated review list", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      {
        id: "r-1",
        rating: 5,
        comment: "Bra!",
        reply: null,
        createdAt: new Date("2026-02-10"),
        customer: { firstName: "Anna", lastName: "S" },
        provider: { businessName: "Kliniken" },
        booking: { bookingDate: new Date("2026-02-01") },
      },
    ] as never)
    vi.mocked(prisma.review.count).mockResolvedValue(1)
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([
      {
        id: "cr-1",
        rating: 4,
        comment: "Fin häst",
        createdAt: new Date("2026-02-09"),
        customer: { firstName: "Erik", lastName: "J" },
        provider: { businessName: "Stall AB" },
        booking: { bookingDate: new Date("2026-01-20") },
      },
    ] as never)
    vi.mocked(prisma.customerReview.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/reviews")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.reviews).toHaveLength(2)
    // Sorted by createdAt desc
    expect(data.reviews[0].id).toBe("r-1")
    expect(data.reviews[0].type).toBe("review")
    expect(data.reviews[1].id).toBe("cr-1")
    expect(data.reviews[1].type).toBe("customerReview")
    expect(data.total).toBe(2)
  })

  it("should filter by type=review", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/reviews?type=review")
    const response = await GET(request)

    expect(response.status).toBe(200)
    // Should only query reviews, not customerReviews
    expect(prisma.review.findMany).toHaveBeenCalled()
    expect(prisma.customerReview.findMany).not.toHaveBeenCalled()
  })

  it("should filter by type=customerReview", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/reviews?type=customerReview")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.customerReview.findMany).toHaveBeenCalled()
    expect(prisma.review.findMany).not.toHaveBeenCalled()
  })

  it("should search in comments", async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.count).mockResolvedValue(0)
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/reviews?search=bra")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          comment: expect.objectContaining({ contains: "bra" }),
        }),
      })
    )
  })

  it("should return 401 for unauthenticated request", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/admin/reviews")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("should return 403 for non-admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

    const request = new NextRequest("http://localhost:3000/api/admin/reviews")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/reviews")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
