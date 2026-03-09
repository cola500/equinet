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

const mockGetPublicById = vi.fn()
const mockGetSpots = vi.fn()

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => ({
    getPublicById: mockGetPublicById,
  }),
}))

vi.mock("@/domain/stable/StableSpotServiceFactory", () => ({
  createStableSpotService: () => ({
    getSpots: mockGetSpots,
  }),
}))

function makeRequest(stableId: string) {
  return new NextRequest(`http://localhost:3000/api/stables/${stableId}`, {
    method: "GET",
  })
}

const mockParams = { stableId: "s1" }

const mockStable = {
  id: "s1",
  name: "Testgården",
  description: "Fint stall",
  city: "Göteborg",
  municipality: "Göteborg",
  latitude: 57.7,
  longitude: 12.0,
  contactEmail: "test@test.se",
  contactPhone: "070-1234567",
  profileImageUrl: null,
  isActive: true,
  _count: { spots: 5, availableSpots: 2 },
}

const mockSpots = [
  { id: "sp1", label: "Box 1", status: "available", pricePerMonth: 5000, availableFrom: null, notes: null },
  { id: "sp2", label: "Box 2", status: "rented", pricePerMonth: 5000, availableFrom: null, notes: null },
  { id: "sp3", label: "Box 3", status: "available", pricePerMonth: 4500, availableFrom: null, notes: "Stor box" },
]

describe("GET /api/stables/[stableId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockGetPublicById.mockResolvedValue(mockStable)
    mockGetSpots.mockResolvedValue(mockSpots)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const res = await GET(makeRequest("s1"), { params: Promise.resolve(mockParams) })
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("stable_profiles")
  })

  it("returns 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const res = await GET(makeRequest("s1"), { params: Promise.resolve(mockParams) })
    expect(res.status).toBe(429)
  })

  it("returns 404 when stable does not exist", async () => {
    mockGetPublicById.mockResolvedValue(null)

    const res = await GET(makeRequest("nonexistent"), { params: Promise.resolve({ stableId: "nonexistent" }) })
    expect(res.status).toBe(404)
  })

  it("returns stable profile with available spots only", async () => {
    const res = await GET(makeRequest("s1"), { params: Promise.resolve(mockParams) })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.name).toBe("Testgården")
    expect(json._count.availableSpots).toBe(2)
    // Only available spots should be returned
    expect(json.availableSpots).toHaveLength(2)
    expect(json.availableSpots[0].label).toBe("Box 1")
    expect(json.availableSpots[1].label).toBe("Box 3")
  })

  it("works for unauthenticated users", async () => {
    const res = await GET(makeRequest("s1"), { params: Promise.resolve(mockParams) })
    expect(res.status).toBe(200)
  })

  it("does not expose sensitive fields", async () => {
    const res = await GET(makeRequest("s1"), { params: Promise.resolve(mockParams) })
    const json = await res.json()
    expect(json.userId).toBeUndefined()
    expect(json.address).toBeUndefined()
    expect(json.postalCode).toBeUndefined()
    expect(json.createdAt).toBeUndefined()
    expect(json.updatedAt).toBeUndefined()
  })
})
