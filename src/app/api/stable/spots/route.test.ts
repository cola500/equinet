import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"
import { isFeatureEnabled } from "@/lib/feature-flags"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const mockGetByUserId = vi.fn()
const mockCreateSpot = vi.fn()
const mockGetSpots = vi.fn()
const mockGetCounts = vi.fn()

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => ({
    getByUserId: mockGetByUserId,
  }),
}))

vi.mock("@/domain/stable/StableSpotServiceFactory", () => ({
  createStableSpotService: () => ({
    createSpot: mockCreateSpot,
    getSpots: mockGetSpots,
    getCounts: mockGetCounts,
  }),
}))

function mockAuth(overrides?: Record<string, unknown>) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user-1", userType: "customer", stableId: "stable-1", ...overrides },
  } as never)
}

function makeRequest(method: string, body?: object) {
  return new NextRequest("http://localhost:3000/api/stable/spots", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("GET /api/stable/spots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    mockAuth()

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(404)
  })

  it("returns 403 when user has no stable", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue(null)

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(403)
  })

  it("returns spots with counts", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })
    mockGetSpots.mockResolvedValue([
      { id: "spot-1", label: "Box 1", status: "available" },
    ])
    mockGetCounts.mockResolvedValue({ total: 1, available: 1 })

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.spots).toHaveLength(1)
    expect(data._count.total).toBe(1)
  })
})

describe("POST /api/stable/spots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    mockAuth()

    const res = await POST(makeRequest("POST", { label: "Box 1" }))
    expect(res.status).toBe(404)
  })

  it("returns 403 when user has no stable", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue(null)

    const res = await POST(makeRequest("POST", { label: "Box 1" }))
    expect(res.status).toBe(403)
  })

  it("returns 400 for invalid JSON", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })

    const req = new NextRequest("http://localhost:3000/api/stable/spots", {
      method: "POST",
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates a spot", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })
    mockCreateSpot.mockResolvedValue({
      isSuccess: true,
      value: { id: "spot-1", label: "Box 1", status: "available" },
    })

    const res = await POST(makeRequest("POST", { label: "Box 1" }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.label).toBe("Box 1")
  })
})
