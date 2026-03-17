import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"
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

const mockStableService = {
  getByUserId: vi.fn(),
}

const mockInviteService = {
  createInvite: vi.fn(),
  listInvites: vi.fn(),
}

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => mockStableService,
}))

vi.mock("@/domain/stable/StableInviteServiceFactory", () => ({
  createStableInviteService: () => mockInviteService,
}))

vi.mock("@/lib/email", () => ({
  sendStableInviteNotification: vi.fn().mockResolvedValue(undefined),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockSession = {
  user: { id: "user-1", email: "owner@test.se", stableId: "stable-1" },
} as never

describe("POST /api/stable/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockStableService.getByUserId.mockResolvedValue({ id: "stable-1", name: "Testgården" })
  })

  it("returns 404 when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({ email: "anna@test.se" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({ email: "anna@test.se" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({ email: "anna@test.se" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 403 when user has no stable", async () => {
    mockStableService.getByUserId.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({ email: "anna@test.se" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("creates invite and returns 201", async () => {
    mockInviteService.createInvite.mockResolvedValue(
      Result.ok({ token: "abc123", expiresAt: new Date() })
    )
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({ email: "anna@test.se" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.message).toBe("Inbjudan skapad")
    expect(data.inviteUrl).toBe("/invite/stable/abc123")
    expect(mockInviteService.createInvite).toHaveBeenCalledWith("stable-1", "anna@test.se")
  })

  it("returns 400 for invalid email", async () => {
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing email", async () => {
    const req = new NextRequest("http://localhost/api/stable/invites", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe("GET /api/stable/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockStableService.getByUserId.mockResolvedValue({ id: "stable-1", name: "Testgården" })
  })

  it("returns list of invites", async () => {
    mockInviteService.listInvites.mockResolvedValue([
      { id: "inv-1", email: "anna@test.se", expiresAt: new Date(), usedAt: null, createdAt: new Date() },
    ])
    const req = new NextRequest("http://localhost/api/stable/invites")
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].email).toBe("anna@test.se")
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const req = new NextRequest("http://localhost/api/stable/invites")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 403 when user has no stable", async () => {
    mockStableService.getByUserId.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/stable/invites")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
