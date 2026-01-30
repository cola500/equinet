import { describe, it, expect, beforeEach, vi } from "vitest"
import { PUT } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    providerVerification: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
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
  user: { id: "admin-user-1", email: "admin@test.se", userType: "provider" },
} as any

const mockNonAdminSession = {
  user: { id: "regular-user-1", email: "user@test.se", userType: "provider" },
} as any

const routeContext = {
  params: Promise.resolve({ id: "ver-1" }),
}

describe("PUT /api/admin/verification-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should approve a verification request and set provider as verified", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-user-1",
      isAdmin: true,
    } as any)
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "pending",
      provider: { userId: "provider-user-1" },
    } as any)
    vi.mocked(prisma.$transaction).mockResolvedValue({
      id: "ver-1",
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: "admin-user-1",
    } as any)

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
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it("should reject a verification request", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-user-1",
      isAdmin: true,
    } as any)
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "pending",
      provider: { userId: "provider-user-1" },
    } as any)
    vi.mocked(prisma.$transaction).mockResolvedValue({
      id: "ver-1",
      status: "rejected",
    } as any)

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
    vi.mocked(auth).mockResolvedValue(mockNonAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "regular-user-1",
      isAdmin: false,
    } as any)

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
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-user-1",
      isAdmin: true,
    } as any)
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
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-user-1",
      isAdmin: true,
    } as any)
    vi.mocked(prisma.providerVerification.findUnique).mockResolvedValue({
      id: "ver-1",
      providerId: "provider-1",
      status: "approved", // Already processed
      provider: { userId: "provider-user-1" },
    } as any)

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
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-user-1",
      isAdmin: true,
    } as any)

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
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

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
