import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

// Mock AuthService
const mockResendVerification = vi.fn()
vi.mock("@/domain/auth/AuthService", () => ({
  createAuthService: () => ({
    resendVerification: mockResendVerification,
  }),
}))

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    resendVerification: vi.fn(() => true),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
}))

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should send verification email for unverified user", async () => {
    mockResendVerification.mockResolvedValue(Result.ok({ sent: true }))

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
  })

  it("should return same response for non-existent email (prevent enumeration)", async () => {
    mockResendVerification.mockResolvedValue(Result.ok({ sent: false }))

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
  })

  it("should not send email for already verified user", async () => {
    mockResendVerification.mockResolvedValue(Result.ok({ sent: false }))

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

  it("should return 500 on unexpected error", async () => {
    mockResendVerification.mockRejectedValue(new Error("SMTP connection failed"))

    const request = new NextRequest(
      "http://localhost:3000/api/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain("Något gick fel")
  })
})
