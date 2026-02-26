import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fortnoxConnection: {
      upsert: vi.fn(),
    },
  },
}))
vi.mock("@/lib/encryption", () => ({ encrypt: vi.fn() }))
vi.mock("@/lib/fortnox-client", () => ({ exchangeCodeForTokens: vi.fn() }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"
import { exchangeCodeForTokens } from "@/lib/fortnox-client"
import { logger } from "@/lib/logger"

const BASE_URL = "http://localhost:3000/api/integrations/fortnox/callback"

const mockProviderSession = {
  user: {
    id: "user-1",
    email: "provider@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as any

const mockCustomerSession = {
  user: {
    id: "user-2",
    email: "customer@test.se",
    userType: "customer",
  },
} as any

const mockProviderSessionNoProviderId = {
  user: {
    id: "user-3",
    email: "provider-no-id@test.se",
    userType: "provider",
  },
} as any

function makeRequest(
  params: Record<string, string> = {},
  cookie?: string
): NextRequest {
  const url = new URL(BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const headers: Record<string, string> = {}
  if (cookie) {
    headers["Cookie"] = cookie
  }

  return new NextRequest(url, { method: "GET", headers })
}

function getRedirectLocation(response: Response): string {
  return response.headers.get("location") || ""
}

describe("GET /api/integrations/fortnox/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FORTNOX_CLIENT_ID = "test-client-id"
    process.env.FORTNOX_CLIENT_SECRET = "test-client-secret"
    process.env.FORTNOX_REDIRECT_URI = "http://localhost:3000/api/integrations/fortnox/callback"
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = makeRequest({ code: "abc", state: "xyz" })
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("redirects to / when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)

    const request = makeRequest({ code: "abc", state: "xyz" })
    const response = await GET(request)

    expect(response.status).toBe(307)
    const location = getRedirectLocation(response)
    expect(location).toContain("/")
    expect(location).not.toContain("/provider")
  })

  it("redirects with error=denied when OAuth error param is present", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest({ error: "access_denied" })
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=denied")
  })

  it("logs warning when OAuth error param is present", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest({ error: "access_denied" })
    await GET(request)

    expect(logger.warn).toHaveBeenCalledWith("Fortnox OAuth denied", {
      error: "access_denied",
      userId: "user-1",
    })
  })

  it("redirects with error=missing_params when code is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest({ state: "xyz" })
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=missing_params")
  })

  it("redirects with error=missing_params when state is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest({ code: "abc" })
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=missing_params")
  })

  it("redirects with error=state_mismatch when no cookie is present", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest({ code: "abc", state: "test-state" })
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=state_mismatch")
  })

  it("redirects with error=state_mismatch when cookie does not match state param", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest(
      { code: "abc", state: "test-state" },
      "fortnox_oauth_state=different-state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=state_mismatch")
  })

  it("logs security event on state mismatch", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)

    const request = makeRequest(
      { code: "abc", state: "test-state" },
      "fortnox_oauth_state=wrong-state"
    )
    await GET(request)

    expect(logger.security).toHaveBeenCalledWith(
      "Fortnox OAuth state mismatch",
      "high",
      { userId: "user-1" }
    )
  })

  it("redirects with error=no_provider when session has no providerId", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSessionNoProviderId)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at-123",
      refresh_token: "rt-123",
      expires_in: 3600,
    } as any)

    const request = makeRequest(
      { code: "abc", state: "test-state" },
      "fortnox_oauth_state=test-state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=no_provider")
  })

  it("exchanges code, encrypts tokens, upserts, and redirects to success on happy path", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "access-token-123",
      refresh_token: "refresh-token-456",
      expires_in: 3600,
    } as any)
    vi.mocked(encrypt)
      .mockReturnValueOnce("encrypted-access-token")
      .mockReturnValueOnce("encrypted-refresh-token")
    vi.mocked(prisma.fortnoxConnection.upsert).mockResolvedValue({} as any)

    const request = makeRequest(
      { code: "auth-code", state: "csrf-state" },
      "fortnox_oauth_state=csrf-state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("success=true")
  })

  it("calls exchangeCodeForTokens with correct params", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
    } as any)
    vi.mocked(encrypt).mockReturnValue("encrypted")
    vi.mocked(prisma.fortnoxConnection.upsert).mockResolvedValue({} as any)

    const request = makeRequest(
      { code: "my-code", state: "my-state" },
      "fortnox_oauth_state=my-state"
    )
    await GET(request)

    expect(exchangeCodeForTokens).toHaveBeenCalledWith(
      "my-code",
      "test-client-id",
      "test-client-secret",
      "http://localhost:3000/api/integrations/fortnox/callback"
    )
  })

  it("calls encrypt for both access_token and refresh_token", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "the-access-token",
      refresh_token: "the-refresh-token",
      expires_in: 3600,
    } as any)
    vi.mocked(encrypt).mockReturnValue("encrypted")
    vi.mocked(prisma.fortnoxConnection.upsert).mockResolvedValue({} as any)

    const request = makeRequest(
      { code: "code", state: "state" },
      "fortnox_oauth_state=state"
    )
    await GET(request)

    // encrypt is called 4 times: 2 in create + 2 in update
    expect(encrypt).toHaveBeenCalledWith("the-access-token")
    expect(encrypt).toHaveBeenCalledWith("the-refresh-token")
  })

  it("calls prisma.fortnoxConnection.upsert with encrypted tokens", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 7200,
    } as any)
    let callIndex = 0
    vi.mocked(encrypt).mockImplementation(() => {
      callIndex++
      return `encrypted-${callIndex}`
    })
    vi.mocked(prisma.fortnoxConnection.upsert).mockResolvedValue({} as any)

    const request = makeRequest(
      { code: "code", state: "state" },
      "fortnox_oauth_state=state"
    )
    await GET(request)

    expect(prisma.fortnoxConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: "provider-1" },
        create: expect.objectContaining({
          providerId: "provider-1",
          accessToken: "encrypted-1",
          refreshToken: "encrypted-2",
        }),
        update: expect.objectContaining({
          accessToken: "encrypted-3",
          refreshToken: "encrypted-4",
        }),
      })
    )
  })

  it("clears fortnox_oauth_state cookie on success", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
    } as any)
    vi.mocked(encrypt).mockReturnValue("encrypted")
    vi.mocked(prisma.fortnoxConnection.upsert).mockResolvedValue({} as any)

    const request = makeRequest(
      { code: "code", state: "state" },
      "fortnox_oauth_state=state"
    )
    const response = await GET(request)

    const setCookieHeader = response.headers.get("set-cookie")
    expect(setCookieHeader).toBeDefined()
    expect(setCookieHeader).toContain("fortnox_oauth_state")
    // Cookie deletion sets max-age=0 or expires in the past
    expect(
      setCookieHeader!.includes("Max-Age=0") ||
        setCookieHeader!.includes("max-age=0") ||
        setCookieHeader!.includes("Expires=Thu, 01 Jan 1970")
    ).toBe(true)
  })

  it("redirects to error=token_exchange when exchangeCodeForTokens throws", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(
      new Error("Token exchange failed")
    )

    const request = makeRequest(
      { code: "code", state: "state" },
      "fortnox_oauth_state=state"
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(getRedirectLocation(response)).toContain("error=token_exchange")
  })

  it("logs info on successful connection", async () => {
    vi.mocked(auth).mockResolvedValue(mockProviderSession)
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
    } as any)
    vi.mocked(encrypt).mockReturnValue("encrypted")
    vi.mocked(prisma.fortnoxConnection.upsert).mockResolvedValue({} as any)

    const request = makeRequest(
      { code: "code", state: "state" },
      "fortnox_oauth_state=state"
    )
    await GET(request)

    expect(logger.info).toHaveBeenCalledWith("Fortnox connected", {
      userId: "user-1",
      providerId: "provider-1",
    })
  })
})
