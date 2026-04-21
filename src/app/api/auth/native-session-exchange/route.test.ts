import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock @supabase/ssr
const mockGetUser = vi.fn()
const mockSetSession = vi.fn()
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      setSession: mockSetSession,
    },
  })),
}))

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {
    name = "RateLimitServiceError"
  },
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { POST } from "./route"
import { rateLimiters } from "@/lib/rate-limit"

function makeRequest(
  token?: string,
  body?: Record<string, string>,
  extraHeaders?: Record<string, string>
): NextRequest {
  const headers = new Headers()
  headers.set("Content-Type", "application/json")
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value)
    }
  }
  return new NextRequest("http://localhost:3000/api/auth/native-session-exchange", {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("POST /api/auth/native-session-exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
  })

  it("returns 401 when no Bearer token is provided", async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 401 when Supabase rejects the token", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    })

    const res = await POST(makeRequest("invalid-token"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig token")
  })

  it("returns 200 and success when token is valid", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    })

    const res = await POST(makeRequest("valid-supabase-access-token"))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it("passes the access token to getUser for verification", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    })

    await POST(makeRequest("my-jwt-token"))
    expect(mockGetUser).toHaveBeenCalledWith("my-jwt-token")
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false)

    const res = await POST(makeRequest("some-token"))
    expect(res.status).toBe(429)
  })

  it("calls setSession when refreshToken is in X-Refresh-Token header", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    })
    mockSetSession.mockResolvedValue({ error: null })

    const res = await POST(
      makeRequest("access-token", undefined, { "X-Refresh-Token": "refresh-token" })
    )
    expect(res.status).toBe(200)
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    })
  })

  it("does not call setSession when no X-Refresh-Token header", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    })

    await POST(makeRequest("access-token"))
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it("returns 503 when rate limiter service is unavailable", async () => {
    const { RateLimitServiceError } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockRejectedValue(
      new RateLimitServiceError("Redis unavailable")
    )

    const res = await POST(makeRequest("some-token"))
    expect(res.status).toBe(503)
  })
})
