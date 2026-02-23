import { describe, it, expect, beforeEach, vi } from "vitest"
import { DELETE, GET } from "./route"
import { auth } from "@/lib/auth-server"
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

const mockUnfollow = vi.fn()
const mockIsFollowing = vi.fn()
const mockGetFollowerCount = vi.fn()

vi.mock("@/domain/follow/FollowServiceFactory", () => ({
  createFollowService: () => ({
    unfollow: mockUnfollow,
    isFollowing: mockIsFollowing,
    getFollowerCount: mockGetFollowerCount,
  }),
}))

function makeRequest(method: string, providerId: string) {
  return new NextRequest(
    `http://localhost:3000/api/follows/${providerId}`,
    { method }
  )
}

const routeContext = (providerId: string) => ({
  params: Promise.resolve({ providerId }),
})

describe("DELETE /api/follows/:providerId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 200 on successful unfollow", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockUnfollow.mockResolvedValue({ ok: true, value: undefined })

    const response = await DELETE(makeRequest("DELETE", "p1"), routeContext("p1"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it("should return 200 even when not following (idempotent)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockUnfollow.mockResolvedValue({ ok: true, value: undefined })

    const response = await DELETE(makeRequest("DELETE", "p1"), routeContext("p1"))
    expect(response.status).toBe(200)
  })
})

describe("GET /api/follows/:providerId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return follow status with isFollowing true", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockIsFollowing.mockResolvedValue(true)
    mockGetFollowerCount.mockResolvedValue(5)

    const response = await GET(makeRequest("GET", "p1"), routeContext("p1"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isFollowing).toBe(true)
    expect(data.followerCount).toBe(5)
  })

  it("should return follow status with isFollowing false", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockIsFollowing.mockResolvedValue(false)
    mockGetFollowerCount.mockResolvedValue(3)

    const response = await GET(makeRequest("GET", "p1"), routeContext("p1"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isFollowing).toBe(false)
    expect(data.followerCount).toBe(3)
  })
})
