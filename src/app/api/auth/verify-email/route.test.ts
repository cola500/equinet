import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailVerificationToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should verify email with valid token", async () => {
    const mockToken = {
      id: "token-123",
      token: "valid-token",
      userId: "user-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      usedAt: null,
      user: {
        id: "user-123",
        email: "test@example.com",
      },
    }

    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      mockToken as any
    )
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}])

    const request = new NextRequest(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({ token: "valid-token" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe("E-postadressen har verifierats")
    expect(data.email).toBe("test@example.com")
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it("should return 400 for invalid token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({ token: "invalid-token" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Ogiltig eller utgången verifieringslänk")
  })

  it("should return 400 for already used token", async () => {
    const mockToken = {
      id: "token-123",
      token: "used-token",
      userId: "user-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: new Date(), // Already used
      user: {
        id: "user-123",
        email: "test@example.com",
      },
    }

    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      mockToken as any
    )

    const request = new NextRequest(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({ token: "used-token" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Denna verifieringslänk har redan använts")
  })

  it("should return 400 for expired token", async () => {
    const mockToken = {
      id: "token-123",
      token: "expired-token",
      userId: "user-123",
      expiresAt: new Date(Date.now() - 1000), // Expired
      usedAt: null,
      user: {
        id: "user-123",
        email: "test@example.com",
      },
    }

    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(
      mockToken as any
    )

    const request = new NextRequest(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({ token: "expired-token" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Verifieringslänken har gått ut. Begär en ny.")
  })

  it("should return 400 for missing token", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 400 for invalid JSON", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        body: "invalid json",
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Ogiltig JSON")
  })
})
