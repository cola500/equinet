import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, DELETE } from "./route"
import * as authServer from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import * as rateLimit from "@/lib/rate-limit"
import { NextResponse } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    availabilityException: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    profileUpdate: vi.fn(),
  },
}))

describe("GET /api/providers/[id]/availability-exceptions/[date]", () => {
  const mockProviderId = "provider-123"
  const mockDate = "2026-01-27"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return a specific exception", async () => {
    const mockException = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
      startTime: null,
      endTime: null,
      reason: "Semester",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(mockException as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.date).toBe("2026-01-27")
    expect(data.isClosed).toBe(true)
    expect(data.reason).toBe("Semester")
  })

  it("should return 404 if exception not found", async () => {
    vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(null)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`
    )
    const response = await GET(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Undantag hittades inte")
  })

  it("should return 400 for invalid date format", async () => {
    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/27-01-2026`
    )
    const response = await GET(request, {
      params: Promise.resolve({ id: mockProviderId, date: "27-01-2026" }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("Ogiltigt datumformat")
  })

  it("should return 400 for date with wrong separator", async () => {
    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/2026/01/27`
    )
    const response = await GET(request, {
      params: Promise.resolve({ id: mockProviderId, date: "2026/01/27" }),
    })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /api/providers/[id]/availability-exceptions/[date]", () => {
  const mockProviderId = "provider-123"
  const mockUserId = "user-123"
  const mockDate = "2026-01-27"

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: rate limiting allows request
    vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(true)
  })

  it("should delete an exception", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockDeleted = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
      startTime: null,
      endTime: null,
      reason: "Semester",
    }
    vi.mocked(prisma.availabilityException.delete).mockResolvedValue(mockDeleted as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.message).toBe("Undantag borttaget")
    expect(data.date).toBe("2026-01-27")
  })

  it("should return 404 if exception not found", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    // Prisma throws P2025 when record to delete doesn't exist
    const prismaError = new Error("Record not found")
    ;(prismaError as any).code = "P2025"
    vi.mocked(prisma.availabilityException.delete).mockRejectedValue(prismaError)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Undantag hittades inte")
  })

  it("should return 400 for invalid date format", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/27-01-2026`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: "27-01-2026" }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("Ogiltigt datumformat")
  })

  it("should return 401 if not authenticated", async () => {
    vi.mocked(authServer.auth).mockRejectedValue(
      NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    )

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(401)
  })

  it("should return 403 if not a provider", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "customer" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(403)
  })

  it("should return 403 if not owner of provider profile", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: "different-user-id", // Different owner
    } as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(rateLimit.rateLimiters.profileUpdate).mockResolvedValue(false) // Rate limited

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    const response = await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain("För många förfrågningar")
  })

  it("should call delete with correct parameters", async () => {
    const mockSession = {
      user: { id: mockUserId, userType: "provider" },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const mockDeleted = {
      id: "exc-1",
      providerId: mockProviderId,
      date: new Date("2026-01-27"),
      isClosed: true,
    }
    vi.mocked(prisma.availabilityException.delete).mockResolvedValue(mockDeleted as any)

    const request = new Request(
      `http://localhost/api/providers/${mockProviderId}/availability-exceptions/${mockDate}`,
      { method: "DELETE" }
    )
    await DELETE(request, {
      params: Promise.resolve({ id: mockProviderId, date: mockDate }),
    })

    expect(prisma.availabilityException.delete).toHaveBeenCalledWith({
      where: {
        providerId_date: {
          providerId: mockProviderId,
          date: expect.any(Date),
        },
      },
    })
  })
})
