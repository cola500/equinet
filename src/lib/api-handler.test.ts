import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "./api-handler"

// Mock auth-server
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
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

import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { z } from "zod"

const providerSession = {
  user: { id: "user-1", email: "test@test.se", userType: "provider", isAdmin: false, providerId: "prov-1" },
} as never

const customerSession = {
  user: { id: "user-2", email: "kund@test.se", userType: "customer", isAdmin: false },
} as never

function makeRequest(url = "http://localhost:3000/api/test", opts?: RequestInit) {
  return new NextRequest(url, opts)
}

describe("withApiHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(rateLimiters.api).mockResolvedValue(true)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
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
    vi.mocked(auth).mockResolvedValue(customerSession)

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
    expect(auth).not.toHaveBeenCalled()
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    expect(res.status).toBe(401)
  })

  it("should return 403 when wrong role", async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const handler = withApiHandler({ auth: "provider" }, async () => {
      return NextResponse.json({ ok: true })
    })

    const res = await handler(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(403)
    expect(data.error).toBe("Åtkomst nekad")
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
})
