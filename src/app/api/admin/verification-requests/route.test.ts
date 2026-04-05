import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerVerification: { findMany: vi.fn() },
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
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), security: vi.fn() },
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

const mockFindMany = vi.mocked(prisma.providerVerification.findMany)

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

function createRequest() {
  return new NextRequest(
    "http://localhost:3000/api/admin/verification-requests",
    { method: "GET" }
  )
}

describe("GET /api/admin/verification-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockFindMany.mockResolvedValue([])
  })

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

    const res = await GET(createRequest())
    expect(res.status).toBe(403)
  })

  it("returns 200 with pending verifications list", async () => {
    const mockVerifications = [
      {
        id: "ver-1",
        type: "certification",
        title: "Hästskötarcertifikat",
        description: "Certifierad hästskötare",
        issuer: "SIF",
        year: 2024,
        status: "pending",
        createdAt: new Date().toISOString(),
        provider: { businessName: "Hästklinik AB" },
        images: [{ id: "img-1", url: "https://example.com/cert.jpg", mimeType: "image/jpeg" }],
      },
    ]
    mockFindMany.mockResolvedValue(mockVerifications as never)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(mockVerifications)
    expect(body).toHaveLength(1)
  })

  it("returns 200 with empty array when no pending verifications", async () => {
    mockFindMany.mockResolvedValue([])

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it("verifies prisma.providerVerification.findMany called with status pending", async () => {
    await GET(createRequest())

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
      })
    )
  })

  it("returns 500 on unexpected error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB connection lost"))

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Internt serverfel")
  })
})
