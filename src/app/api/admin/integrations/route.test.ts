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
    fortnoxConnection: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      count: vi.fn(),
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

describe("GET /api/admin/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as never)
  })

  it("should return integration status", async () => {
    vi.mocked(prisma.fortnoxConnection.findMany).mockResolvedValue([
      {
        providerId: "prov-1",
        provider: { businessName: "Hästkliniken" },
        createdAt: new Date("2026-01-15"),
        expiresAt: new Date("2026-03-15"),
      },
    ] as never)
    vi.mocked(prisma.fortnoxConnection.count).mockResolvedValue(1)

    vi.mocked(prisma.payment.count)
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(80)   // succeeded
      .mockResolvedValueOnce(10)   // pending
      .mockResolvedValueOnce(10)   // failed
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amount: 50000 },
    } as never)

    const request = new NextRequest("http://localhost:3000/api/admin/integrations")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fortnox.totalConnected).toBe(1)
    expect(data.fortnox.connections).toHaveLength(1)
    expect(data.fortnox.connections[0]).toMatchObject({
      providerId: "prov-1",
      businessName: "Hästkliniken",
    })
    expect(data.payments).toMatchObject({
      total: 100,
      succeeded: 80,
      pending: 10,
      failed: 10,
      totalRevenue: 50000,
    })
  })

  it("should handle no integrations", async () => {
    vi.mocked(prisma.fortnoxConnection.findMany).mockResolvedValue([])
    vi.mocked(prisma.fortnoxConnection.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.count).mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as never)

    const request = new NextRequest("http://localhost:3000/api/admin/integrations")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.fortnox.totalConnected).toBe(0)
    expect(data.payments.totalRevenue).toBe(0)
  })

  it("should return 403 for non-admin users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as never)

    const request = new NextRequest("http://localhost:3000/api/admin/integrations")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/integrations")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
