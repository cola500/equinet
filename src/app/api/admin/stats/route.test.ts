import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: vi.fn(),
    },
    booking: {
      count: vi.fn(),
    },
    provider: {
      count: vi.fn(),
    },
    providerVerification: {
      count: vi.fn(),
    },
    payment: {
      aggregate: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
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

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
  })

  it("should return dashboard stats for admin", async () => {
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(70)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(12)

    vi.mocked(prisma.booking.count)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(400)
      .mockResolvedValueOnce(70)
      .mockResolvedValueOnce(50)

    vi.mocked(prisma.provider.count)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(20)

    vi.mocked(prisma.providerVerification.count).mockResolvedValue(3)

    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 150000 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: 25000 } } as never)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toEqual({
      total: 100,
      customers: 70,
      providers: 30,
      newThisMonth: 12,
    })
    expect(data.bookings).toEqual({
      total: 500,
      pending: 10,
      confirmed: 20,
      completed: 400,
      cancelled: 70,
      completedThisMonth: 50,
    })
    expect(data.providers).toEqual({
      total: 30,
      active: 25,
      verified: 20,
      pendingVerifications: 3,
    })
    expect(data.revenue).toEqual({
      totalCompleted: 150000,
      thisMonth: 25000,
    })
  })

  it("should return 403 for non-admin users", async () => {
    mockGetAuthUser.mockResolvedValue({
      ...adminUser,
      isAdmin: false,
    })

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("should handle null revenue sums", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.provider.count).mockResolvedValue(0)
    vi.mocked(prisma.providerVerification.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: null } } as never)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.revenue.totalCompleted).toBe(0)
    expect(data.revenue.thisMonth).toBe(0)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
