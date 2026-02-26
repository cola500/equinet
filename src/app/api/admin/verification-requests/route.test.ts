import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    providerVerification: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}))

import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.user.findUnique)
const mockFindMany = vi.mocked(prisma.providerVerification.findMany)

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se", userType: "provider" },
} as never

function createRequest() {
  return new NextRequest(
    "http://localhost:3000/api/admin/verification-requests",
    { method: "GET" }
  )
}

describe("GET /api/admin/verification-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockAdminSession)
    mockFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: true } as never)
    mockFindMany.mockResolvedValue([])
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not admin", async () => {
    mockFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: false } as never)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Behörighet saknas")
  })

  it("returns 403 when user not found in DB", async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Behörighet saknas")
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
    expect(body.error).toBe("Kunde inte hämta verifieringsansökningar")
  })
})
