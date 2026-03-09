import { describe, it, expect, beforeEach, vi } from "vitest"
import { PUT, DELETE } from "./route"
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
const mockUpdateSpot = vi.fn()
const mockDeleteSpot = vi.fn()

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => ({
    getByUserId: mockGetByUserId,
  }),
}))

vi.mock("@/domain/stable/StableSpotServiceFactory", () => ({
  createStableSpotService: () => ({
    updateSpot: mockUpdateSpot,
    deleteSpot: mockDeleteSpot,
  }),
}))

function mockAuth(overrides?: Record<string, unknown>) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user-1", userType: "customer", stableId: "stable-1", ...overrides },
  } as never)
}

const params = Promise.resolve({ spotId: "spot-1" })

function makeRequest(method: string, body?: object) {
  return new NextRequest("http://localhost:3000/api/stable/spots/spot-1", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("PUT /api/stable/spots/[spotId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    mockAuth()

    const res = await PUT(makeRequest("PUT", { status: "rented" }), { params })
    expect(res.status).toBe(404)
  })

  it("returns 403 when user has no stable", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue(null)

    const res = await PUT(makeRequest("PUT", { status: "rented" }), { params })
    expect(res.status).toBe(403)
  })

  it("returns 404 when spot not found", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })
    mockUpdateSpot.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: "NOT_FOUND",
    })

    const res = await PUT(makeRequest("PUT", { status: "rented" }), { params })
    expect(res.status).toBe(404)
  })

  it("updates a spot", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })
    mockUpdateSpot.mockResolvedValue({
      isSuccess: true,
      value: { id: "spot-1", status: "rented" },
    })

    const res = await PUT(makeRequest("PUT", { status: "rented" }), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("rented")
  })
})

describe("DELETE /api/stable/spots/[spotId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 403 when user has no stable", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue(null)

    const res = await DELETE(makeRequest("DELETE"), { params })
    expect(res.status).toBe(403)
  })

  it("returns 404 when spot not found", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })
    mockDeleteSpot.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: "NOT_FOUND",
    })

    const res = await DELETE(makeRequest("DELETE"), { params })
    expect(res.status).toBe(404)
  })

  it("deletes a spot", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue({ id: "stable-1" })
    mockDeleteSpot.mockResolvedValue({ isSuccess: true, value: undefined })

    const res = await DELETE(makeRequest("DELETE"), { params })
    expect(res.status).toBe(200)
  })
})
