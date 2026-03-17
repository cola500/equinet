import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { DELETE } from "./route"

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

const mockStableService = {
  getByUserId: vi.fn(),
}

const mockInviteService = {
  revokeInvite: vi.fn(),
}

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => mockStableService,
}))

vi.mock("@/domain/stable/StableInviteServiceFactory", () => ({
  createStableInviteService: () => mockInviteService,
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockSession = {
  user: { id: "user-1", email: "owner@test.se" },
} as never

const routeContext = { params: Promise.resolve({ id: "inv-1" }) }

describe("DELETE /api/stable/invites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockStableService.getByUserId.mockResolvedValue({ id: "stable-1", name: "Testgården" })
  })

  it("returns 404 when feature flag disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 401 when not authenticated", async () => {
    const authResponse = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    vi.mocked(auth).mockRejectedValue(authResponse)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 403 when user has no stable", async () => {
    mockStableService.getByUserId.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    expect(res.status).toBe(403)
  })

  it("revokes invite and returns 200", async () => {
    mockInviteService.revokeInvite.mockResolvedValue(true)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe("Inbjudan återkallad")
    expect(mockInviteService.revokeInvite).toHaveBeenCalledWith("inv-1", "stable-1")
  })

  it("returns 404 when invite not found or already used", async () => {
    mockInviteService.revokeInvite.mockResolvedValue(false)
    const req = new NextRequest("http://localhost/api/stable/invites/inv-1", {
      method: "DELETE",
    })
    const res = await DELETE(req, routeContext)
    expect(res.status).toBe(404)
  })
})
