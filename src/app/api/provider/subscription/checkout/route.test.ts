import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock dependencies
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
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const mockInitiateCheckout = vi.fn()

vi.mock("@/domain/subscription/SubscriptionServiceFactory", () => ({
  createSubscriptionService: () => ({
    initiateCheckout: mockInitiateCheckout,
  }),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { POST } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimiters = vi.mocked(rateLimiters)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const PROVIDER_ID = "a0000000-0000-4000-a000-000000000001"

function makeRequest(body: unknown) {
  return new NextRequest(
    "http://localhost:3000/api/provider/subscription/checkout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

function makeInvalidJsonRequest() {
  return new NextRequest(
    "http://localhost:3000/api/provider/subscription/checkout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }
  )
}

const validBody = {
  planId: "plan_monthly",
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
}

describe("POST /api/provider/subscription/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockRateLimiters.subscription.mockResolvedValue(true)
  })

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(401)
  })

  it("returns 403 when user is customer (not provider)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)

    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(403)

    const data = await response.json()
    expect(data.error).toBe("Åtkomst nekad")
  })

  // --- Rate limiting ---

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockRateLimiters.subscription.mockResolvedValueOnce(false)

    const response = await POST(makeRequest(validBody))
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

    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("provider_subscription")
  })

  // --- JSON parsing ---

  it("returns 400 for invalid JSON", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)

    const response = await POST(makeInvalidJsonRequest())
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  // --- Validation ---

  it("returns 400 for validation error (missing planId)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)

    const response = await POST(
      makeRequest({
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    )
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
    expect(data.details).toBeDefined()
  })

  it("returns 400 for validation error (invalid URL)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)

    const response = await POST(
      makeRequest({
        planId: "plan_monthly",
        successUrl: "not-a-url",
        cancelUrl: "https://example.com/cancel",
      })
    )
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 400 for unknown fields (strict mode)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)

    const response = await POST(
      makeRequest({
        ...validBody,
        extraField: "should-not-be-allowed",
      })
    )
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  // --- Business logic ---

  it("returns 409 when already subscribed", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockInitiateCheckout.mockResolvedValue({
      ok: false,
      error: "ALREADY_SUBSCRIBED",
    })

    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(409)

    const data = await response.json()
    expect(data.error).toBe("Du har redan en aktiv prenumeration")
  })

  it("returns 200 with checkoutUrl on success", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockInitiateCheckout.mockResolvedValue({
      ok: true,
      value: { checkoutUrl: "https://checkout.stripe.com/session_123" },
    })

    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.checkoutUrl).toBe("https://checkout.stripe.com/session_123")
  })

  it("passes providerId from session (not body) to service", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockInitiateCheckout.mockResolvedValue({
      ok: true,
      value: { checkoutUrl: "https://checkout.stripe.com/session_123" },
    })

    await POST(makeRequest(validBody))

    expect(mockInitiateCheckout).toHaveBeenCalledWith(
      PROVIDER_ID,
      "plan_monthly",
      "https://example.com/success",
      "https://example.com/cancel"
    )
  })

  // --- Error handling ---

  it("returns 500 on unexpected errors", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: PROVIDER_ID },
    } as never)
    mockInitiateCheckout.mockRejectedValue(new Error("Stripe crashed"))

    const response = await POST(makeRequest(validBody))
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toBe("Internt serverfel")
  })
})
