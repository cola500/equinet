import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const mockGetStatus = vi.fn()

vi.mock("@/domain/subscription/SubscriptionServiceFactory", () => ({
  createSubscriptionService: () => ({
    getStatus: mockGetStatus,
  }),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { GET } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimiters = vi.mocked(rateLimiters)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const PROVIDER_ID = "a0000000-0000-4000-a000-000000000001"

function createRequest() {
  return new NextRequest(
    "http://localhost:3000/api/provider/subscription/status",
    { method: "GET" }
  )
}

describe("GET /api/provider/subscription/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockRateLimiters.api.mockResolvedValue(true)
  })

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const response = await GET(createRequest())
    expect(response.status).toBe(401)
  })

  it("returns 403 when user is customer", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)

    const response = await GET(createRequest())
    expect(response.status).toBe(403)

    const data = await response.json()
    expect(data.error).toBe("Åtkomst nekad")
  })

  // --- Rate limiting ---

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockRateLimiters.api.mockResolvedValueOnce(false)

    const response = await GET(createRequest())
    expect(response.status).toBe(429)

    const data = await response.json()
    expect(data.error).toBe("För många förfrågningar")
  })

  // --- Feature flag ---

  it("returns 404 when feature flag disabled", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const response = await GET(createRequest())
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("provider_subscription")
  })

  // --- Business logic ---

  it("returns 200 with null when no subscription", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockGetStatus.mockResolvedValue({
      ok: true,
      value: null,
    })

    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toBeNull()
  })

  it("returns 200 with status when subscription exists", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)

    const periodEnd = new Date("2026-03-28T00:00:00.000Z")
    mockGetStatus.mockResolvedValue({
      ok: true,
      value: {
        status: "active",
        planId: "plan_monthly",
        currentPeriodEnd: periodEnd.toISOString(),
        cancelAtPeriodEnd: false,
      },
    })

    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.status).toBe("active")
    expect(data.planId).toBe("plan_monthly")
    expect(data.currentPeriodEnd).toBe(periodEnd.toISOString())
    expect(data.cancelAtPeriodEnd).toBe(false)
  })

  it("passes providerId from session to service", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockGetStatus.mockResolvedValue({
      ok: true,
      value: null,
    })

    await GET(createRequest())

    expect(mockGetStatus).toHaveBeenCalledWith(PROVIDER_ID)
  })

  it("returns 404 when service returns error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockGetStatus.mockResolvedValue({
      ok: false,
      error: "FEATURE_DISABLED",
    })

    const response = await GET(createRequest())
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
  })

  // --- Error handling ---

  it("returns 500 on unexpected errors", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockGetStatus.mockRejectedValue(new Error("DB connection failed"))

    const response = await GET(createRequest())
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toBe("Internt serverfel")
  })
})
