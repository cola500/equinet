import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock dependencies BEFORE imports
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    subscription: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

const mockGetPortalUrl = vi.fn()

vi.mock("@/domain/subscription/SubscriptionServiceFactory", () => ({
  createSubscriptionService: () => ({
    getPortalUrl: mockGetPortalUrl,
  }),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { POST } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimit = vi.mocked(rateLimiters.subscription)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const providerSession = {
  user: {
    id: "user-1",
    userType: "provider",
    providerId: "provider-1",
  },
} as never

const customerSession = {
  user: {
    id: "user-2",
    userType: "customer",
    customerId: "customer-1",
  },
} as never

function createRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/provider/subscription/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : "invalid json{{{",
  })
}

describe("POST /api/provider/subscription/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(providerSession)
    mockRateLimit.mockResolvedValue(true)
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 401 when not logged in", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("returns 403 when user is customer", async () => {
    mockAuth.mockResolvedValue(customerSession)

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe("Åtkomst nekad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toBe("För många förfrågningar")
  })

  it("returns 404 when feature flag disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("provider_subscription")
  })

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/provider/subscription/portal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      }
    )

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("returns 400 for validation error (missing returnUrl)", async () => {
    const request = createRequest({})
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 400 for validation error (invalid returnUrl)", async () => {
    const request = createRequest({ returnUrl: "not-a-url" })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 400 for extra fields (strict schema)", async () => {
    const request = createRequest({
      returnUrl: "https://example.com/dashboard",
      extraField: "should-fail",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 404 when no subscription (NO_SUBSCRIPTION error)", async () => {
    mockGetPortalUrl.mockResolvedValue({
      ok: false,
      error: "NO_SUBSCRIPTION",
    })

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Ingen aktiv prenumeration")
  })

  it("returns 404 when service returns FEATURE_DISABLED", async () => {
    mockGetPortalUrl.mockResolvedValue({
      ok: false,
      error: "FEATURE_DISABLED",
    })

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
  })

  it("returns 200 with portalUrl on success", async () => {
    mockGetPortalUrl.mockResolvedValue({
      ok: true,
      value: { portalUrl: "https://billing.stripe.com/session/test123" },
    })

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.portalUrl).toBe("https://billing.stripe.com/session/test123")
  })

  it("passes providerId from session to service (not from body)", async () => {
    mockGetPortalUrl.mockResolvedValue({
      ok: true,
      value: { portalUrl: "https://billing.stripe.com/session/test123" },
    })

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    await POST(request)

    expect(mockGetPortalUrl).toHaveBeenCalledWith(
      "provider-1",
      "https://example.com/dashboard"
    )
  })

  it("returns 500 on unexpected service error", async () => {
    mockGetPortalUrl.mockRejectedValue(new Error("Stripe API down"))

    const request = createRequest({ returnUrl: "https://example.com/dashboard" })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe("Internt serverfel")
  })
})
