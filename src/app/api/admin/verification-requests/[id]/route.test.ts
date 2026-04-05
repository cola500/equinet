import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerVerification: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
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

import { PUT } from "./route"
import { prisma } from "@/lib/prisma"

const adminUser = {
  id: "admin-user-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

const routeContext = {
  params: Promise.resolve({ id: "ver-1" }),
}

describe("PUT /api/admin/verification-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
  })

  it("should approve a verification request and set provider as verified", async () => {
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "pending",
      title: "Verifiering",
      provider: { userId: "provider-user-1" },
    } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue({
      id: "ver-1",
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: "admin-user-1",
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({
          action: "approve",
          reviewNote: "Allt ser bra ut",
        }),
      }
    )

    const response = await PUT(request, routeContext)
    const _data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it("should reject a verification request", async () => {
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "pending",
      title: "Verifiering",
      provider: { userId: "provider-user-1" },
    } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue({
      id: "ver-1",
      status: "rejected",
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({
          action: "reject",
          reviewNote: "Saknar underlag",
        }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(200)
  })

  it("should return 403 if user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({
          action: "approve",
        }),
      }
    )

    const response = await PUT(request, routeContext)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBeDefined()
  })

  it("should return 404 if verification not found", async () => {
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-999",
      {
        method: "PUT",
        body: JSON.stringify({
          action: "approve",
        }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 400 if verification is not pending", async () => {
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "approved", // Already processed
      title: "Verifiering",
      provider: { userId: "provider-user-1" },
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({
          action: "approve",
        }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(400)
  })

  it("should return 400 for invalid action", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({
          action: "invalid",
        }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(400)
  })

  it("should return 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      }
    )

    const response = await PUT(request, routeContext)

    expect(response.status).toBe(401)
  })

  it("returns 401 when session is null", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({ action: "approve" }),
      }
    )

    const response = await PUT(request, routeContext)
    expect(response.status).toBe(401)
  })
})
