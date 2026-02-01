import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

// Mock AuthService
const mockVerifyEmail = vi.fn()
vi.mock("@/domain/auth/AuthService", () => ({
  createAuthService: () => ({
    verifyEmail: mockVerifyEmail,
  }),
}))

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should verify email with valid token", async () => {
    mockVerifyEmail.mockResolvedValue(
      Result.ok({ email: "test@example.com" })
    )

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
  })

  it("should return 400 for invalid token", async () => {
    mockVerifyEmail.mockResolvedValue(
      Result.fail({
        type: "TOKEN_NOT_FOUND",
        message: "Ogiltig eller utgangen verifieringslank",
      })
    )

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
    expect(data.error).toContain("Ogiltig")
  })

  it("should return 400 for already used token", async () => {
    mockVerifyEmail.mockResolvedValue(
      Result.fail({
        type: "TOKEN_ALREADY_USED",
        message: "Denna verifieringslank har redan anvants",
      })
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
    expect(data.error).toContain("redan")
  })

  it("should return 400 for expired token", async () => {
    mockVerifyEmail.mockResolvedValue(
      Result.fail({
        type: "TOKEN_EXPIRED",
        message: "Verifieringslanken har gatt ut. Begar en ny.",
      })
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
    expect(data.error).toContain("gatt ut")
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
