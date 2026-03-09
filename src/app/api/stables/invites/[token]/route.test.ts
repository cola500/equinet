import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"
import { Result } from "@/domain/shared"

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
  validateToken: vi.fn(),
}

vi.mock("@/domain/stable/StableInviteServiceFactory", () => ({
  createStableInviteService: () => mockInviteService,
}))

import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const routeContext = { params: Promise.resolve({ token: "abc123" }) }

describe("GET /api/stables/invites/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
  })

  it("returns 404 when feature flag disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stables/invites/abc123")
    const res = await GET(req, routeContext)
    expect(res.status).toBe(404)
  })

  it("returns invite info with expiresAt for valid token", async () => {
    const expiresAt = new Date("2026-03-16T12:00:00Z")
    mockInviteService.validateToken.mockResolvedValue(
      Result.ok({
        id: "inv-1",
        token: "abc123",
        email: "anna@test.se",
        stableId: "stable-1",
        stableName: "Testgården",
        stableMunicipality: "Göteborg",
        expiresAt,
        usedAt: null,
        createdAt: new Date(),
      })
    )
    const req = new NextRequest("http://localhost/api/stables/invites/abc123")
    const res = await GET(req, routeContext)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.stableName).toBe("Testgården")
    expect(data.email).toBe("anna@test.se")
    expect(data.expiresAt).toBe(expiresAt.toISOString())
  })

  it("returns 404 with code for invalid token", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.fail("TOKEN_NOT_FOUND")
    )
    const req = new NextRequest("http://localhost/api/stables/invites/bad")
    const res = await GET(req, routeContext)
    const data = await res.json()
    expect(res.status).toBe(404)
    expect(data.code).toBe("TOKEN_NOT_FOUND")
  })

  it("returns 410 with code for expired token", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.fail("TOKEN_EXPIRED")
    )
    const req = new NextRequest("http://localhost/api/stables/invites/expired")
    const res = await GET(req, routeContext)
    const data = await res.json()
    expect(res.status).toBe(410)
    expect(data.code).toBe("TOKEN_EXPIRED")
  })

  it("returns 410 with code for used token", async () => {
    mockInviteService.validateToken.mockResolvedValue(
      Result.fail("TOKEN_USED")
    )
    const req = new NextRequest("http://localhost/api/stables/invites/used")
    const res = await GET(req, routeContext)
    const data = await res.json()
    expect(res.status).toBe(410)
    expect(data.code).toBe("TOKEN_USED")
  })
})
