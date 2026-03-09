import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { PATCH } from "./route"

// Mock dependencies
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

const mockHorseService = {
  setStable: vi.fn(),
}

vi.mock("@/domain/horse/HorseService", () => ({
  createHorseService: () => mockHorseService,
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { Result } from "@/domain/shared"

const mockSession = {
  user: { id: "user-1", email: "anna@test.se", userType: "customer" },
} as never

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/horses/horse-1/stable", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const routeContext = { params: Promise.resolve({ id: "horse-1" }) }

describe("PATCH /api/horses/[id]/stable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const res = await PATCH(makeRequest({ stableId: "s1" }), routeContext)
    expect(res.status).toBe(404)
    expect(isFeatureEnabled).toHaveBeenCalledWith("stable_profiles")
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const res = await PATCH(makeRequest({ stableId: "s1" }), routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockImplementationOnce(() => {
      throw new Response(null, { status: 401 })
    })
    const res = await PATCH(makeRequest({ stableId: "s1" }), routeContext)
    expect(res.status).toBe(401)
  })

  it("sets stableId on horse when valid", async () => {
    mockHorseService.setStable.mockResolvedValue(
      Result.ok({ id: "horse-1", name: "Blansen", stableId: "s1" })
    )
    const res = await PATCH(makeRequest({ stableId: "s1" }), routeContext)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.stableId).toBe("s1")
    expect(mockHorseService.setStable).toHaveBeenCalledWith("horse-1", "s1", "user-1")
  })

  it("removes stableId when stableId is null", async () => {
    mockHorseService.setStable.mockResolvedValue(
      Result.ok({ id: "horse-1", name: "Blansen", stableId: null })
    )
    const res = await PATCH(makeRequest({ stableId: null }), routeContext)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.stableId).toBeNull()
    expect(mockHorseService.setStable).toHaveBeenCalledWith("horse-1", null, "user-1")
  })

  it("returns 404 when horse not found", async () => {
    mockHorseService.setStable.mockResolvedValue(
      Result.fail({ type: "HORSE_NOT_FOUND", message: "Hästen hittades inte" })
    )
    const res = await PATCH(makeRequest({ stableId: "s1" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 404 when stable not found", async () => {
    mockHorseService.setStable.mockResolvedValue(
      Result.fail({ type: "STABLE_NOT_FOUND", message: "Stallet hittades inte" })
    )
    const res = await PATCH(makeRequest({ stableId: "s1" }), routeContext)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("Stallet hittades inte")
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/horses/horse-1/stable", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid stableId type", async () => {
    const res = await PATCH(makeRequest({ stableId: 123 }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 when stableId field is missing", async () => {
    const res = await PATCH(makeRequest({}), routeContext)
    expect(res.status).toBe(400)
  })
})
