import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { NextRequest } from "next/server"
import { isFeatureEnabled } from "@/lib/feature-flags"

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// Mock StableService
const mockSearchPublic = vi.fn()

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => ({
    searchPublic: mockSearchPublic,
  }),
}))

function makeRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/stables")
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url, { method: "GET" })
}

const mockStable = {
  id: "s1",
  name: "Testgården",
  description: "Fint stall",
  city: "Göteborg",
  municipality: "Göteborg",
  profileImageUrl: null,
  contactEmail: "test@test.se",
  contactPhone: "070-1234567",
  _count: { spots: 5, availableSpots: 2 },
}

describe("GET /api/stables", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockSearchPublic.mockResolvedValue([mockStable])
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("stable_profiles")
  })

  it("returns 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })

  it("returns stables without filters", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe("Testgården")
    expect(json.data[0]._count.availableSpots).toBe(2)
    expect(mockSearchPublic).toHaveBeenCalledWith({})
  })

  it("passes municipality filter to service", async () => {
    const res = await GET(makeRequest({ municipality: "Göteborg" }))
    expect(res.status).toBe(200)
    expect(mockSearchPublic).toHaveBeenCalledWith({ municipality: "Göteborg" })
  })

  it("passes city filter to service", async () => {
    const res = await GET(makeRequest({ city: "Mölndal" }))
    expect(res.status).toBe(200)
    expect(mockSearchPublic).toHaveBeenCalledWith({ city: "Mölndal" })
  })

  it("passes search filter to service", async () => {
    const res = await GET(makeRequest({ search: "box" }))
    expect(res.status).toBe(200)
    expect(mockSearchPublic).toHaveBeenCalledWith({ search: "box" })
  })

  it("passes hasAvailableSpots filter when set to true", async () => {
    const res = await GET(makeRequest({ hasAvailableSpots: "true" }))
    expect(res.status).toBe(200)
    expect(mockSearchPublic).toHaveBeenCalledWith({ hasAvailableSpots: true })
  })

  it("works for unauthenticated users", async () => {
    // No auth mock needed - this is a public endpoint
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
  })

  it("returns empty array when no stables match", async () => {
    mockSearchPublic.mockResolvedValue([])

    const res = await GET(makeRequest({ search: "nonexistent" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(0)
  })

  it("does not expose sensitive fields", async () => {
    const res = await GET(makeRequest())
    const json = await res.json()
    const stable = json.data[0]
    expect(stable.userId).toBeUndefined()
    expect(stable.address).toBeUndefined()
    expect(stable.postalCode).toBeUndefined()
    expect(stable.createdAt).toBeUndefined()
    expect(stable.updatedAt).toBeUndefined()
  })
})
