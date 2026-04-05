import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fortnoxConnection: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      count: vi.fn(),
      aggregate: vi.fn(),
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

describe("GET /api/admin/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
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

  it("should return 401 for unauthenticated request", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/admin/integrations")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("should return 403 for non-admin users", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

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
