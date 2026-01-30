import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
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
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
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
} as any

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as any

describe("GET /api/verification-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return provider's own verification requests", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)
    vi.mocked(prisma.providerVerification.findMany).mockResolvedValue([
      {
        id: "ver-1",
        providerId: "provider-1",
        type: "education",
        title: "Wångens gesällprov",
        description: "Godkänd hovslagare",
        status: "pending",
        createdAt: new Date(),
      },
    ] as any)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests"
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      id: "ver-1",
      type: "education",
      title: "Wångens gesällprov",
      status: "pending",
    })
  })

  it("should return 404 if user has no provider profile", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests"
    )
    const response = await GET(request)

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
    vi.mocked(auth).mockRejectedValue(unauthorizedResponse)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests"
    )
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})

describe("POST /api/verification-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should create a verification request", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)
    vi.mocked(prisma.providerVerification.count).mockResolvedValue(0)
    vi.mocked(prisma.providerVerification.create).mockResolvedValue({
      id: "ver-new",
      providerId: "provider-1",
      type: "education",
      title: "Wångens gesällprov",
      description: "Godkänd hovslagare",
      status: "pending",
      createdAt: new Date(),
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: JSON.stringify({
          type: "education",
          title: "Wångens gesällprov",
          description: "Godkänd hovslagare",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data).toMatchObject({
      id: "ver-new",
      type: "education",
      title: "Wångens gesällprov",
      status: "pending",
    })
  })

  it("should return 400 for invalid type", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: JSON.stringify({
          type: "invalid-type",
          title: "Test",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation error")
  })

  it("should return 400 when title is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: JSON.stringify({
          type: "education",
        }),
      }
    )

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("should reject when 5 pending requests already exist (max limit)", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)
    vi.mocked(prisma.providerVerification.count).mockResolvedValue(5)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: JSON.stringify({
          type: "education",
          title: "En till ansökan",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("5")
  })

  it("should return 404 if user has no provider profile", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: JSON.stringify({
          type: "education",
          title: "Test",
        }),
      }
    )

    const response = await POST(request)

    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: "not json",
      }
    )

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("should set providerId from session, not request body (IDOR)", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(prisma.provider.findFirst).mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    } as any)
    vi.mocked(prisma.providerVerification.count).mockResolvedValue(0)
    vi.mocked(prisma.providerVerification.create).mockResolvedValue({
      id: "ver-new",
      providerId: "provider-1",
    } as any)

    const request = new NextRequest(
      "http://localhost:3000/api/verification-requests",
      {
        method: "POST",
        body: JSON.stringify({
          type: "education",
          title: "Test",
          providerId: "attacker-provider-id", // Should be ignored
        }),
      }
    )

    await POST(request)

    expect(prisma.providerVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerId: "provider-1", // From session lookup
        }),
      })
    )
  })
})
