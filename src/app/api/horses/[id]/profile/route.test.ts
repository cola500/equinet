import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

// Mock service factory
const mockService = {
  createProfileToken: vi.fn(),
}

vi.mock("@/domain/horse/HorseService", () => ({
  createHorseService: () => mockService,
}))

const mockSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as never

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) })

describe("POST /api/horses/[id]/profile", () => {
  beforeEach(() => vi.clearAllMocks())

  it("should create profile token for owned horse", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    mockService.createProfileToken.mockResolvedValue(Result.ok({
      token: "abc123def456",
      expiresAt: new Date("2026-03-01"),
    }))

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/profile",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("horse-1"))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.token).toBeDefined()
    expect(data.url).toContain("/profile/")
    expect(data.expiresAt).toBeDefined()
  })

  it("should set 30 day expiry", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    mockService.createProfileToken.mockResolvedValue(Result.ok({
      token: "test-token",
      expiresAt,
    }))

    const request = new NextRequest(
      "http://localhost:3000/api/horses/horse-1/profile",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("horse-1"))
    const data = await response.json()

    // Check that expiry is approximately 30 days from now
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const expiresAtMs = new Date(data.expiresAt).getTime()
    expect(expiresAtMs - now).toBeGreaterThan(thirtyDays - 60000)
    expect(expiresAtMs - now).toBeLessThan(thirtyDays + 60000)
  })

  it("should return 404 for non-owned horse (IDOR protection)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    mockService.createProfileToken.mockResolvedValue(
      Result.fail({ type: "HORSE_NOT_FOUND", message: "Hasten hittades inte" })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/horses/other-horse/profile",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("other-horse"))

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
      "http://localhost:3000/api/horses/horse-1/profile",
      { method: "POST" }
    )
    const response = await POST(request, makeContext("horse-1"))

    expect(response.status).toBe(401)
  })
})
