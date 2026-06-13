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

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"

function createRequest(url = "http://localhost/api/native/help/hantera-bokningar") {
  return new Request(url, {
    headers: { authorization: "Bearer test-token" },
  }) as unknown as import("next/server").NextRequest
}

const mockProviderUser = {
  id: "user-1",
  email: "test@test.com",
  userType: "provider" as const,
} as ReturnType<typeof getAuthUser> extends Promise<infer T> ? NonNullable<T> : never

describe("GET /api/native/help/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const res = await GET(createRequest(), {
      params: Promise.resolve({ slug: "hantera-bokningar" }),
    })
    expect(res.status).toBe(401)
  })

  it("returns article by slug", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(mockProviderUser)

    const res = await GET(createRequest(), {
      params: Promise.resolve({ slug: "hantera-bokningar" }),
    })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.article).toBeDefined()
    expect(data.article.slug).toBe("hantera-bokningar")
    expect(data.article.content).toBeDefined()
    expect(data.article.content.length).toBeGreaterThan(0)
  })

  it("returns 404 for unknown slug", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(mockProviderUser)

    const res = await GET(createRequest(), {
      params: Promise.resolve({ slug: "nonexistent-article" }),
    })
    expect(res.status).toBe(404)
  })
})
