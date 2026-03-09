import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
import { Result } from "@/domain/shared"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockInviteService = {
  acceptInvite: vi.fn(),
  validateToken: vi.fn(),
}

vi.mock("@/domain/stable/StableInviteServiceFactory", () => ({
  createStableInviteService: () => mockInviteService,
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockSession = {
  user: { id: "user-1", email: "anna@test.se" },
} as never

const routeContext = { params: Promise.resolve({ token: "abc123" }) }

describe("POST /api/stables/invites/[token]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
  })

  it("returns 404 when feature flag disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stables/invites/abc123/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stables/invites/abc123/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 401 when not authenticated", async () => {
    const authResponse = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    vi.mocked(auth).mockRejectedValue(authResponse)
    const req = new NextRequest("http://localhost/api/stables/invites/abc123/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    expect(res.status).toBe(401)
  })

  it("accepts invite when email matches (case-insensitive)", async () => {
    // Session email is "anna@test.se", invite email is "Anna@Test.SE"
    mockInviteService.validateToken.mockResolvedValue(
      Result.ok({
        id: "inv-1",
        token: "abc123",
        email: "Anna@Test.SE",
        stableId: "stable-1",
        stableName: "Testgården",
        stableMunicipality: "Göteborg",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        createdAt: new Date(),
      })
    )
    mockInviteService.acceptInvite.mockResolvedValue(
      Result.ok({ stableId: "stable-1", stableName: "Testgården" })
    )
    const req = new NextRequest("http://localhost/api/stables/invites/abc123/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.stableId).toBe("stable-1")
    expect(data.stableName).toBe("Testgården")
  })

  it("returns 403 when email does not match", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.ok({
        id: "inv-1",
        token: "abc123",
        email: "other@test.se",
        stableId: "stable-1",
        stableName: "Testgården",
        stableMunicipality: "Göteborg",
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        createdAt: new Date(),
      })
    )
    const req = new NextRequest("http://localhost/api/stables/invites/abc123/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.code).toBe("EMAIL_MISMATCH")
    expect(data.error).toContain("annan e-postadress")
  })

  it("returns 404 for invalid token", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.fail("TOKEN_NOT_FOUND")
    )
    const req = new NextRequest("http://localhost/api/stables/invites/bad/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.code).toBe("TOKEN_NOT_FOUND")
  })

  it("returns 410 for expired token", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.fail("TOKEN_EXPIRED")
    )
    const req = new NextRequest("http://localhost/api/stables/invites/exp/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    const data = await res.json()
    expect(res.status).toBe(410)
    expect(data.code).toBe("TOKEN_EXPIRED")
  })

  it("returns 410 for used token", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.fail("TOKEN_USED")
    )
    const req = new NextRequest("http://localhost/api/stables/invites/used/accept", {
      method: "POST",
    })
    const res = await POST(req, routeContext)
    const data = await res.json()
    expect(res.status).toBe(410)
    expect(data.code).toBe("TOKEN_USED")
  })
})
