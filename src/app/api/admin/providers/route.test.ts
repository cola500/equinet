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
    },
    provider: {
      findMany: vi.fn(),
      count: vi.fn(),
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
} as any

describe("GET /api/admin/providers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as any)
  })

  it("should return paginated provider list with counts", async () => {
    vi.mocked(prisma.provider.findMany).mockResolvedValue([
      {
        id: "prov-1",
        businessName: "Hästkliniken",
        city: "Stockholm",
        isVerified: true,
        isActive: true,
        createdAt: new Date("2026-01-10"),
        _count: { bookings: 15, services: 3 },
        reviews: [{ rating: 5 }, { rating: 4 }],
        fortnoxConnection: { id: "fc-1" },
      },
    ] as any)
    vi.mocked(prisma.provider.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/providers")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.providers).toHaveLength(1)
    expect(data.providers[0]).toMatchObject({
      id: "prov-1",
      businessName: "Hästkliniken",
      city: "Stockholm",
      isVerified: true,
      isActive: true,
      bookingCount: 15,
      serviceCount: 3,
      averageRating: 4.5,
      hasFortnox: true,
    })
    expect(data.total).toBe(1)
  })

  it("should filter by verified status", async () => {
    vi.mocked(prisma.provider.findMany).mockResolvedValue([])
    vi.mocked(prisma.provider.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/providers?verified=true")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isVerified: true }),
      })
    )
  })

  it("should filter by active status", async () => {
    vi.mocked(prisma.provider.findMany).mockResolvedValue([])
    vi.mocked(prisma.provider.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/providers?active=false")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    )
  })

  it("should handle provider with no reviews (null average)", async () => {
    vi.mocked(prisma.provider.findMany).mockResolvedValue([
      {
        id: "prov-2",
        businessName: "Ny leverantör",
        city: null,
        isVerified: false,
        isActive: true,
        createdAt: new Date("2026-02-01"),
        _count: { bookings: 0, services: 0 },
        reviews: [],
        fortnoxConnection: null,
      },
    ] as any)
    vi.mocked(prisma.provider.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/providers")
    const response = await GET(request)
    const data = await response.json()

    expect(data.providers[0].averageRating).toBeNull()
    expect(data.providers[0].hasFortnox).toBe(false)
  })

  it("should return 403 for non-admin users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as any)

    const request = new NextRequest("http://localhost:3000/api/admin/providers")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/providers")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
