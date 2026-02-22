import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

// Mock AuthService
const mockRequestPasswordReset = vi.fn()
vi.mock("@/domain/auth/AuthService", () => ({
  createAuthService: () => ({
    requestPasswordReset: mockRequestPasswordReset,
  }),
}))

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    passwordReset: vi.fn(() => true),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
}))

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return success for existing user", async () => {
    mockRequestPasswordReset.mockResolvedValue(Result.ok({ sent: true }))

    const request = new NextRequest(
      "http://localhost:3000/api/auth/forgot-password",
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
    mockRequestPasswordReset.mockResolvedValue(Result.ok({ sent: false }))

    const request = new NextRequest(
      "http://localhost:3000/api/auth/forgot-password",
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

  it("should return 400 for invalid email format", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/forgot-password",
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
      "http://localhost:3000/api/auth/forgot-password",
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
    vi.mocked(rateLimiters.passwordReset).mockResolvedValueOnce(false)

    const request = new NextRequest(
      "http://localhost:3000/api/auth/forgot-password",
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

  it("should reject extra fields with strict validation", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com", extra: "field" }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 500 on unexpected error", async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error("DB connection failed"))

    const request = new NextRequest(
      "http://localhost:3000/api/auth/forgot-password",
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
