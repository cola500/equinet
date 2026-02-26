import { describe, it, expect, beforeEach, vi } from "vitest"
import { PUT, DELETE } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: {
      findFirst: vi.fn(),
    },
    providerVerification: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    upload: {
      deleteMany: vi.fn(),
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

const mockProviderSession = {
  user: { id: "provider-user-1", email: "magnus@test.se", userType: "provider" },
} as never

const mockProvider = {
  id: "provider-1",
  userId: "provider-user-1",
}

const mockPendingVerification = {
  id: "ver-1",
  providerId: "provider-1",
  type: "education",
  title: "Wångens gesällprov",
  description: "Godkänd hovslagare",
  issuer: null,
  year: null,
  status: "pending",
  reviewedAt: null,
  reviewedBy: null,
  reviewNote: null,
}

const mockRejectedVerification = {
  ...mockPendingVerification,
  id: "ver-rejected",
  status: "rejected",
  reviewNote: "Behöver mer dokumentation",
  reviewedAt: new Date(),
  reviewedBy: "admin-1",
}

const mockApprovedVerification = {
  ...mockPendingVerification,
  id: "ver-approved",
  status: "approved",
  reviewedAt: new Date(),
  reviewedBy: "admin-1",
}

function createParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// --- PUT Tests ---

describe("PUT /api/verification-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should update a pending verification request", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockPendingVerification as never)
    vi.mocked(prisma.providerVerification.update).mockResolvedValue({
      ...mockPendingVerification,
      title: "Uppdaterad titel",
      issuer: "Wången",
      year: 2020,
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({
          title: "Uppdaterad titel",
          issuer: "Wången",
          year: 2020,
        }),
      }
    )

    const response = await PUT(request, createParams("ver-1"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.title).toBe("Uppdaterad titel")
    expect(data.issuer).toBe("Wången")
    expect(data.year).toBe(2020)
  })

  it("should reset rejected status to pending on edit", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockRejectedVerification as never)
    vi.mocked(prisma.providerVerification.update).mockResolvedValue({
      ...mockRejectedVerification,
      title: "Bättre titel",
      status: "pending",
      reviewNote: null,
      reviewedAt: null,
      reviewedBy: null,
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-rejected",
      {
        method: "PUT",
        body: JSON.stringify({ title: "Bättre titel" }),
      }
    )

    const response = await PUT(request, createParams("ver-rejected"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe("pending")
    expect(data.reviewNote).toBeNull()

    // Verify the update was called with status reset
    expect(prisma.providerVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
        }),
      })
    )
  })

  it("should reject edit on approved verification (400)", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockApprovedVerification as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-approved",
      {
        method: "PUT",
        body: JSON.stringify({ title: "Ska inte gå" }),
      }
    )

    const response = await PUT(request, createParams("ver-approved"))

    expect(response.status).toBe(400)
  })

  it("should return 404 for IDOR attempt", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(null) // Not found with this provider

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/other-provider-ver",
      {
        method: "PUT",
        body: JSON.stringify({ title: "Hackat" }),
      }
    )

    const response = await PUT(request, createParams("other-provider-ver"))

    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockPendingVerification as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-1",
      {
        method: "PUT",
        body: "not json",
      }
    )

    const response = await PUT(request, createParams("ver-1"))

    expect(response.status).toBe(400)
  })

  it("should return 400 for invalid year", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockPendingVerification as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-1",
      {
        method: "PUT",
        body: JSON.stringify({ year: 1800 }),
      }
    )

    const response = await PUT(request, createParams("ver-1"))

    expect(response.status).toBe(400)
  })
})

// --- DELETE Tests ---

describe("DELETE /api/verification-requests/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should delete a pending verification", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockPendingVerification as never)
    vi.mocked(prisma.upload.deleteMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(prisma.providerVerification.delete).mockResolvedValue(mockPendingVerification as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-1",
      { method: "DELETE" }
    )

    const response = await DELETE(request, createParams("ver-1"))

    expect(response.status).toBe(204)
    expect(prisma.upload.deleteMany).toHaveBeenCalledWith({
      where: { verificationId: "ver-1" },
    })
    expect(prisma.providerVerification.delete).toHaveBeenCalledWith({
      where: { id: "ver-1" },
    })
  })

  it("should delete a rejected verification", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockRejectedVerification as never)
    vi.mocked(prisma.upload.deleteMany).mockResolvedValue({ count: 2 } as never)
    vi.mocked(prisma.providerVerification.delete).mockResolvedValue(mockRejectedVerification as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-rejected",
      { method: "DELETE" }
    )

    const response = await DELETE(request, createParams("ver-rejected"))

    expect(response.status).toBe(204)
  })

  it("should reject delete on approved verification (400)", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(mockApprovedVerification as never)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-approved",
      { method: "DELETE" }
    )

    const response = await DELETE(request, createParams("ver-approved"))

    expect(response.status).toBe(400)
  })

  it("should return 404 for IDOR attempt", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(mockProvider as never)
    vi.mocked(prisma.providerVerification.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/other-ver",
      { method: "DELETE" }
    )

    const response = await DELETE(request, createParams("other-ver"))

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests/ver-1",
      { method: "DELETE" }
    )

    const response = await DELETE(request, createParams("ver-1"))

    expect(response.status).toBe(401)
  })
})
