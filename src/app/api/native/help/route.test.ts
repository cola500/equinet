import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))

// Mock feature flags
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}))

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { isFeatureEnabled } from "@/lib/feature-flags"

function createRequest(url = "http://localhost/api/native/help") {
  return new Request(url, {
    headers: { authorization: "Bearer test-token" },
  }) as unknown as import("next/server").NextRequest
}

describe("GET /api/native/help", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns 404 when help_center flag is disabled", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      userType: "provider",
    } as ReturnType<typeof getAuthUser> extends Promise<infer T> ? NonNullable<T> : never)
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const res = await GET(createRequest())
    expect(res.status).toBe(404)
  })

  it("returns provider articles for provider user", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      userType: "provider",
    } as ReturnType<typeof getAuthUser> extends Promise<infer T> ? NonNullable<T> : never)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const res = await GET(createRequest())
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.articles).toBeDefined()
    expect(data.sections).toBeDefined()
    expect(data.articles.length).toBeGreaterThan(0)
    expect(data.articles[0].role).toBe("provider")
  })

  it("returns customer articles for customer user", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      userType: "customer",
    } as ReturnType<typeof getAuthUser> extends Promise<infer T> ? NonNullable<T> : never)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const res = await GET(createRequest())
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.articles.length).toBeGreaterThan(0)
    expect(data.articles[0].role).toBe("customer")
  })

  it("filters articles by search query", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      userType: "provider",
    } as ReturnType<typeof getAuthUser> extends Promise<infer T> ? NonNullable<T> : never)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const res = await GET(
      createRequest("http://localhost/api/native/help?q=bokning")
    )
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.articles.length).toBeGreaterThan(0)
    expect(data.articles.length).toBeLessThan(27) // filtered, not all
  })
})
