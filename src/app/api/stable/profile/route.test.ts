import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, POST, PUT } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"
import { isFeatureEnabled } from "@/lib/feature-flags"

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

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// Mock StableService
const mockCreateStable = vi.fn()
const mockGetByUserId = vi.fn()
const mockUpdateStable = vi.fn()

vi.mock("@/domain/stable/StableServiceFactory", () => ({
  createStableService: () => ({
    createStable: mockCreateStable,
    getByUserId: mockGetByUserId,
    updateStable: mockUpdateStable,
  }),
}))

function makeRequest(method: string, body?: object) {
  return new NextRequest("http://localhost:3000/api/stable/profile", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

function mockAuth(overrides?: Record<string, unknown>) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user-1", userType: "customer", ...overrides },
  } as never)
}

describe("GET /api/stable/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    mockAuth()

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("stable_profiles")
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when user has no stable", async () => {
    mockAuth()
    mockGetByUserId.mockResolvedValue(null)

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(404)
  })

  it("returns stable profile", async () => {
    mockAuth()
    const stable = { id: "s1", name: "Test Stall", userId: "user-1" }
    mockGetByUserId.mockResolvedValue(stable)

    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe("Test Stall")
  })
})

describe("POST /api/stable/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    mockAuth()

    const res = await POST(makeRequest("POST", { name: "Stall A" }))
    expect(res.status).toBe(404)
  })

  it("returns 400 for invalid JSON", async () => {
    mockAuth()
    const req = new NextRequest("http://localhost:3000/api/stable/profile", {
      method: "POST",
      body: "not-json",
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for validation errors", async () => {
    mockAuth()
    const res = await POST(makeRequest("POST", { name: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when user already has a stable", async () => {
    mockAuth()
    mockCreateStable.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: "ALREADY_EXISTS",
    })

    const res = await POST(makeRequest("POST", { name: "Stall A" }))
    expect(res.status).toBe(409)
  })

  it("creates stable and returns stableId", async () => {
    mockAuth()
    const stable = { id: "s1", name: "Stall A", userId: "user-1" }
    mockCreateStable.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: stable,
    })

    const res = await POST(makeRequest("POST", { name: "Stall A" }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.stableId).toBe("s1")
    expect(data.name).toBe("Stall A")
  })
})

describe("PUT /api/stable/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    mockAuth()

    const res = await PUT(makeRequest("PUT", { name: "Updated" }))
    expect(res.status).toBe(404)
  })

  it("returns 400 for invalid JSON", async () => {
    mockAuth()
    const req = new NextRequest("http://localhost:3000/api/stable/profile", {
      method: "PUT",
      body: "not-json",
    })

    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it("returns 404 when user has no stable", async () => {
    mockAuth()
    mockUpdateStable.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: "NOT_FOUND",
    })

    const res = await PUT(makeRequest("PUT", { name: "Updated" }))
    expect(res.status).toBe(404)
  })

  it("updates and returns stable", async () => {
    mockAuth()
    const stable = { id: "s1", name: "Updated", userId: "user-1" }
    mockUpdateStable.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: stable,
    })

    const res = await PUT(makeRequest("PUT", { name: "Updated" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe("Updated")
  })
})
