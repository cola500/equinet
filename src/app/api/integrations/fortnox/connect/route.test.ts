import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const providerSession = {
  user: {
    id: "user-1",
    email: "magnus@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as never

const customerSession = {
  user: { id: "user-2", email: "anna@test.se", userType: "customer" },
} as never

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/integrations/fortnox/connect")
}

describe("GET /api/integrations/fortnox/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    // Set required env vars
    process.env.FORTNOX_CLIENT_ID = "test-client-id"
    process.env.FORTNOX_REDIRECT_URI = "http://localhost:3000/api/integrations/fortnox/callback"
  })

  afterEach(() => {
    delete process.env.FORTNOX_CLIENT_ID
    delete process.env.FORTNOX_REDIRECT_URI
  })

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 for customer users", async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain("leverantorer")
  })

  // --- Rate limiting ---

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false)

    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  // --- Env var validation ---

  it("returns 503 when FORTNOX_CLIENT_ID is missing", async () => {
    delete process.env.FORTNOX_CLIENT_ID

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toContain("konfigurerad")
  })

  it("returns 503 when FORTNOX_REDIRECT_URI is missing", async () => {
    delete process.env.FORTNOX_REDIRECT_URI

    const res = await GET(makeRequest())
    expect(res.status).toBe(503)
  })

  // --- Happy path ---

  it("redirects to Fortnox OAuth URL for authenticated provider", async () => {
    const res = await GET(makeRequest())

    // Redirect responses have status 307
    expect(res.status).toBe(307)

    const location = res.headers.get("location")
    expect(location).toContain("apps.fortnox.se/oauth-v1/auth")
    expect(location).toContain("client_id=test-client-id")
    expect(location).toContain("scope=invoice")
    expect(location).toContain("response_type=code")
  })

  it("sets httpOnly state cookie for CSRF protection", async () => {
    const res = await GET(makeRequest())

    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain("fortnox_oauth_state")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Path=/")
  })

  it("includes state parameter in redirect URL matching cookie", async () => {
    const res = await GET(makeRequest())

    const location = res.headers.get("location") || ""
    const stateMatch = location.match(/state=([a-f0-9]+)/)
    expect(stateMatch).toBeTruthy()
    expect(stateMatch![1]).toHaveLength(64) // 32 bytes hex = 64 chars
  })
})
