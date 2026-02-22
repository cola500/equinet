import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

// Mock AuthService
const mockResetPassword = vi.fn()
vi.mock("@/domain/auth/AuthService", () => ({
  createAuthService: () => ({
    resetPassword: mockResetPassword,
  }),
}))

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    passwordReset: vi.fn(() => true),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
}))

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should reset password with valid token and new password", async () => {
    mockResetPassword.mockResolvedValue(Result.ok({ email: "test@example.com" }))

    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "valid-token",
          password: "NewPassword1!",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toContain("Lösenordet har återställts")
  })

  it("should return 400 for invalid/expired token", async () => {
    mockResetPassword.mockResolvedValue(
      Result.fail({ type: "TOKEN_EXPIRED", message: "Återställningslänken har gått ut." })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "expired-token",
          password: "NewPassword1!",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("Återställningslänken har gått ut")
  })

  it("should return 400 for already used token", async () => {
    mockResetPassword.mockResolvedValue(
      Result.fail({ type: "TOKEN_ALREADY_USED", message: "Denna återställningslänk har redan använts" })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "used-token",
          password: "NewPassword1!",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("redan använts")
  })

  it("should return 400 for weak password", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "valid-token",
          password: "weak",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 400 for missing token", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          password: "NewPassword1!",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 400 for invalid JSON", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
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
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "valid-token",
          password: "NewPassword1!",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain("För många försök")
  })

  it("should reject extra fields with strict validation", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "valid-token",
          password: "NewPassword1!",
          extra: "field",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 500 on unexpected error", async () => {
    mockResetPassword.mockRejectedValue(new Error("DB connection failed"))

    const request = new NextRequest(
      "http://localhost:3000/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token: "valid-token",
          password: "NewPassword1!",
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain("Något gick fel")
  })
})
