import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
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
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se" },
} as never

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return dashboard stats for admin", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as never)

    // User counts
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(70)   // customers
      .mockResolvedValueOnce(30)   // providers
      .mockResolvedValueOnce(12)   // newThisMonth

    // Booking counts
    vi.mocked(prisma.booking.count)
      .mockResolvedValueOnce(500)  // total
      .mockResolvedValueOnce(10)   // pending
      .mockResolvedValueOnce(20)   // confirmed
      .mockResolvedValueOnce(400)  // completed
      .mockResolvedValueOnce(70)   // cancelled
      .mockResolvedValueOnce(50)   // completedThisMonth

    // Provider counts
    vi.mocked(prisma.provider.count)
      .mockResolvedValueOnce(30)   // total
      .mockResolvedValueOnce(25)   // active
      .mockResolvedValueOnce(20)   // verified

    // Pending verifications
    vi.mocked(prisma.providerVerification.count).mockResolvedValue(3)

    // Revenue
    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 150000 } } as never)  // totalCompleted
      .mockResolvedValueOnce({ _sum: { amount: 25000 } } as never)   // thisMonth

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
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as never)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 401 when not authenticated", async () => {
    const unauthResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthResponse)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("should handle null revenue sums", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as never)

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
    vi.mocked(auth).mockResolvedValue(mockAdminSession)

    const request = new NextRequest("http://localhost:3000/api/admin/stats")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
