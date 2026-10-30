import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({ getAuthUser: vi.fn() }))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const BASE_URL = "http://localhost:3000/api/optimize-route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Same shape as the real session from getAuthUser (userType, not role)
const providerUser = {
  id: "user-1", email: "maria@test.se", userType: "provider", isAdmin: false,
  providerId: "provider-1", stableId: null, authMethod: "supabase" as const,
}

const customerUser = {
  ...providerUser, userType: "customer", providerId: null,
}

// Exactly what src/lib/route-optimizer.ts sends: coordinates only
const validBody = {
  start_location: { lat: 59.2753, lon: 15.2134 },
  orders: [
    { lat: 59.61, lon: 16.55 }, // Västerås
    { lat: 59.08, lon: 15.11 }, // Kumla
    { lat: 59.13, lon: 15.14 }, // Hallsberg
  ],
}

describe("POST /api/optimize-route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(providerUser)
    mockRateLimit.mockResolvedValue(true)
    mockIsFeatureEnabled.mockResolvedValue(true)
    global.fetch = vi.fn()
  })

  it("returns an optimized visiting order for a logged-in provider", async () => {
    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect([...data.route].sort()).toEqual([0, 1, 2])
    expect(data).toMatchObject({
      num_stops: 3,
      total_distance_km: expect.any(Number),
      baseline_distance_km: expect.any(Number),
      improvement_percent: expect.any(Number),
    })
    expect(data.total_distance_km).toBeLessThanOrEqual(data.baseline_distance_km)
  })

  it("optimizes inside Equinet without calling external services", async () => {
    await POST(makeRequest(validBody))

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("rejects personal data fields so only coordinates are accepted", async () => {
    const res = await POST(makeRequest({
      ...validBody,
      orders: validBody.orders.map((o) => ({ ...o, customer: "Anders Bergman", address: "Ekebyvägen 12" })),
    }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Valideringsfel")
  })

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe("Ej inloggad")
  })

  it("returns 403 when the user is not a provider", async () => {
    mockGetAuthUser.mockResolvedValue(customerUser)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe("Åtkomst nekad")
  })

  it("returns 404 when route planning is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(429)
  })

  it("returns 503 when the rate limiter is unavailable (fail-closed)", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("redis down"))

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(503)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Ogiltig JSON")
  })

  it("returns 400 when start_location is missing", async () => {
    const res = await POST(makeRequest({ orders: validBody.orders }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Valideringsfel")
  })

  it("returns 400 when fewer than 2 orders are sent", async () => {
    const res = await POST(makeRequest({ ...validBody, orders: [validBody.orders[0]] }))

    expect(res.status).toBe(400)
  })

  it("returns 400 when too many orders are sent", async () => {
    const orders = Array.from({ length: 101 }, () => ({ lat: 59, lon: 15 }))

    const res = await POST(makeRequest({ ...validBody, orders }))

    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid coordinates", async () => {
    const res = await POST(makeRequest({
      ...validBody,
      orders: [{ lat: 200, lon: 15 }, validBody.orders[1]],
    }))

    expect(res.status).toBe(400)
  })

  it("rejects unknown fields at top level", async () => {
    const res = await POST(makeRequest({ ...validBody, hack: true }))

    expect(res.status).toBe(400)
  })
})
