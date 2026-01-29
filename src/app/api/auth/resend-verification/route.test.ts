import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
    },
  },
}))

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    resendVerification: vi.fn(() => true),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
}))

// Mock email service
vi.mock("@/lib/email", () => ({
  sendEmailVerificationNotification: vi.fn(() => Promise.resolve()),
}))

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should send verification email for unverified user", async () => {
    const mockUser = {
      id: "user-123",
      firstName: "Test",
      email: "test@example.com",
      emailVerified: false,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue({} as any)

    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain("Om e-postadressen finns")
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled()
  })

  it("should return same response for non-existent email (prevent enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "nonexistent@example.com" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain("Om e-postadressen finns")
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled()
  })

  it("should not send email for already verified user", async () => {
    const mockUser = {
      id: "user-123",
      firstName: "Test",
      email: "test@example.com",
      emailVerified: true, // Already verified
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain("Om e-postadressen finns")
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled()
  })

  it("should return 400 for invalid email format", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "invalid-email" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 400 for invalid JSON", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
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

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.resendVerification).mockResolvedValueOnce(false)

    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain("För många försök")
  })
})
