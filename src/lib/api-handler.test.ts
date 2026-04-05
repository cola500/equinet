import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "./api-handler"

// Mock auth-dual (withApiHandler will use getAuthUser after migration)
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))


// Mock rate-limit
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

// Mock feature-flags
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { getAuthUser } from "@/lib/auth-dual"
import type { AuthUser } from "@/lib/auth-dual"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { z } from "zod"

const mockGetAuthUser = vi.mocked(getAuthUser)

// Mock prisma for audit log
const mockAuditCreate = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}))

const adminAuthUser: AuthUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase",
}

const providerAuthUser: AuthUser = {
  id: "user-1",
  email: "test@test.se",
  userType: "provider",
  isAdmin: false,
  providerId: "prov-1",
  stableId: null,
  authMethod: "supabase",
}

const customerAuthUser: AuthUser = {
  id: "user-2",
  email: "kund@test.se",
  userType: "customer",
  isAdmin: false,
  providerId: null,
  stableId: null,
  authMethod: "supabase",
}

function makeRequest(url = "http://localhost:3000/api/test", opts?: RequestInit) {
  return new NextRequest(url, opts)
}

describe("withApiHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(providerAuthUser)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAuditCreate.mockResolvedValue({})
  })

  // --- Auth ---

  it("should pass provider context for auth: 'provider'", async () => {
    const handler = withApiHandler({ auth: "provider" }, async (ctx) => {
      return NextResponse.json({ userId: ctx.user.userId, providerId: ctx.user.providerId })
    })

    const res = await handler(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.userId).toBe("user-1")
    expect(data.providerId).toBe("prov-1")
  })

  it("should pass customer context for auth: 'customer'", async () => {
    mockGetAuthUser.mockResolvedValue(customerAuthUser)

    const handler = withApiHandler({ auth: "customer" }, async (ctx) => {
      return NextResponse.json({ userId: ctx.user.userId })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
  })

  it("should pass any-auth context for auth: 'any'", async () => {
    const handler = withApiHandler({ auth: "any" }, async (ctx) => {
      return NextResponse.json({ userId: ctx.user.userId })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
  })

  it("should skip auth for auth: 'none'", async () => {
    const handler = withApiHandler({ auth: "none" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
    expect(mockGetAuthUser).not.toHaveBeenCalled()
  })

  it("should return 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(401)
  })

  it("should return 403 when wrong role", async () => {
    mockGetAuthUser.mockResolvedValue(customerAuthUser)

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe("Åtkomst nekad")
  })

  it("should map provider AuthUser to SessionLike with providerId set", async () => {
    const handler = withApiHandler({ auth: "provider" }, async (ctx) => {
      return NextResponse.json({ providerId: ctx.user.providerId })
    })

    const res = await handler(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.providerId).toBe("prov-1")
    expect(typeof data.providerId).toBe("string")
  })

  it("should return 403 when provider has null providerId", async () => {
    mockGetAuthUser.mockResolvedValue({
      ...providerAuthUser,
      providerId: null,
    })

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe("Leverantörsprofil saknas")
  })

  it("should authenticate via any auth method (Bearer, Supabase)", async () => {
    mockGetAuthUser.mockResolvedValue({
      ...providerAuthUser,
      authMethod: "supabase",
    })

    const handler = withApiHandler({ auth: "provider" }, async (ctx) => {
      return NextResponse.json({ userId: ctx.user.userId })
    })

    const res = await handler(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.userId).toBe("user-1")
  })

  // --- Rate limiting ---

  it("should rate limit by default", async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false)

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(429)
    expect(data.error).toBe("För många förfrågningar")
  })

  it("should skip rate limiting when rateLimit: false", async () => {
    const handler = withApiHandler({ auth: "provider", rateLimit: false }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
    expect(rateLimiters.api).not.toHaveBeenCalled()
  })

  it("should use custom rate limiter", async () => {
    vi.mocked(rateLimiters.booking).mockResolvedValue(true)

    const handler = withApiHandler({ auth: "provider", rateLimit: "booking" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
    expect(rateLimiters.booking).toHaveBeenCalled()
  })

  it("should return 503 on RateLimitServiceError", async () => {
    vi.mocked(rateLimiters.api).mockRejectedValue(new RateLimitServiceError("Redis down"))

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(503)
    expect(data.error).toBe("Tjänsten är tillfälligt otillgänglig")
  })

  // --- Feature flags ---

  it("should return 404 when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const handler = withApiHandler({ auth: "provider", featureFlag: "voice_logging" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(404)
    expect(isFeatureEnabled).toHaveBeenCalledWith("voice_logging")
  })

  it("should proceed when feature flag is enabled", async () => {
    const handler = withApiHandler({ auth: "provider", featureFlag: "voice_logging" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
  })

  // --- Body parsing + Zod ---

  it("should parse and validate request body", async () => {
    const schema = z.object({ name: z.string() })

    const handler = withApiHandler({ auth: "provider", schema }, async (ctx) => {
      return NextResponse.json({ name: ctx.body.name })
    })

    const res = await handler(makeRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    }))

    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.name).toBe("Test")
  })

  it("should return 400 for invalid JSON", async () => {
    const schema = z.object({ name: z.string() })

    const handler = withApiHandler({ auth: "provider", schema }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: "not json",
    }))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("should return 400 for Zod validation failure", async () => {
    const schema = z.object({ name: z.string().min(1) })

    const handler = withApiHandler({ auth: "provider", schema }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    }))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Valideringsfel")
    expect(data.details).toBeDefined()
  })

  // --- Error handling ---

  it("should catch unhandled errors and return 500", async () => {
    const handler = withApiHandler({ auth: "provider" }, async () => {
      throw new Error("Something broke")
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Internt serverfel")
  })

  it("should pass through thrown Response objects", async () => {
    const handler = withApiHandler({ auth: "provider" }, async () => {
      throw NextResponse.json({ error: "Custom" }, { status: 422 })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(422)
  })

  // --- Request passthrough ---

  it("should pass request to handler", async () => {
    const handler = withApiHandler({ auth: "provider" }, async (ctx) => {
      const param = ctx.request.nextUrl.searchParams.get("q")
      return NextResponse.json({ q: param })
    })

    const res = await handler(makeRequest("http://localhost:3000/api/test?q=hello"))
    const data = await res.json()
    expect(data.q).toBe("hello")
  })

  // --- Admin auth ---

  it("should pass admin context for auth: 'admin'", async () => {
    mockGetAuthUser.mockResolvedValue(adminAuthUser)

    const handler = withApiHandler({ auth: "admin" }, async (ctx) => {
      return NextResponse.json({ userId: ctx.user.userId })
    })

    const res = await handler(makeRequest("http://localhost:3000/api/admin/test"))
    expect(res.status).toBe(200)
  })

  it("should return 403 when non-admin accesses admin route", async () => {
    mockGetAuthUser.mockResolvedValue(providerAuthUser) // isAdmin: false

    const handler = withApiHandler({ auth: "admin" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(403)
  })

  it("should return 401 when unauthenticated accesses admin route", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const handler = withApiHandler({ auth: "admin" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(401)
  })

  // --- Audit log ---

  it("should create audit log entry for admin requests", async () => {
    mockGetAuthUser.mockResolvedValue(adminAuthUser)
    mockAuditCreate.mockResolvedValue({})

    const handler = withApiHandler({ auth: "admin" }, async () => {
      return NextResponse.json({ ok: true })
    })

    await handler(makeRequest("http://localhost:3000/api/admin/system", { method: "POST" }))

    // Fire-and-forget -- wait a tick for the promise to settle
    await new Promise((r) => setTimeout(r, 10))

    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "admin-1",
        userEmail: "admin@test.se",
        action: "POST /api/admin/system",
        statusCode: 200,
      }),
    })
  })

  it("should NOT create audit log for non-admin requests", async () => {
    mockGetAuthUser.mockResolvedValue(providerAuthUser)

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    await handler(makeRequest())
    await new Promise((r) => setTimeout(r, 10))

    expect(mockAuditCreate).not.toHaveBeenCalled()
  })

  it("should still return response even if audit log fails", async () => {
    mockGetAuthUser.mockResolvedValue(adminAuthUser)
    mockAuditCreate.mockRejectedValue(new Error("DB down"))

    const handler = withApiHandler({ auth: "admin" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest("http://localhost:3000/api/admin/test"))
    expect(res.status).toBe(200)
  })
})
