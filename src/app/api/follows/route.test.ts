import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST, GET } from "./route"
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

// Mock the FollowService via its factory
const mockFollow = vi.fn()
const mockGetFollowedProviders = vi.fn()

vi.mock("@/domain/follow/FollowServiceFactory", () => ({
  createFollowService: () => ({
    follow: mockFollow,
    getFollowedProviders: mockGetFollowedProviders,
  }),
}))

// Valid UUID for Zod validation
const PROVIDER_ID = "a0000000-0000-4000-a000-000000000001"

function makeRequest(method: string, body?: object) {
  return new NextRequest("http://localhost:3000/api/follows", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("POST /api/follows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not logged in", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await POST(makeRequest("POST", { providerId: PROVIDER_ID }))
    expect(response.status).toBe(401)
  })

  it("should return 403 when user is not a customer", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "provider" },
    } as any)

    const response = await POST(makeRequest("POST", { providerId: PROVIDER_ID }))
    expect(response.status).toBe(403)
  })

  it("should return 404 when feature flag is disabled", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const response = await POST(makeRequest("POST", { providerId: PROVIDER_ID }))
    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const request = new NextRequest("http://localhost:3000/api/follows", {
      method: "POST",
      body: "not json",
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("should return 404 when provider not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockFollow.mockResolvedValue({ ok: false, error: "PROVIDER_NOT_FOUND" })

    const response = await POST(makeRequest("POST", { providerId: PROVIDER_ID }))
    expect(response.status).toBe(404)
  })

  it("should return 201 on success", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockFollow.mockResolvedValue({
      ok: true,
      value: {
        id: "f1",
        customerId: "u1",
        providerId: PROVIDER_ID,
        createdAt: new Date("2026-01-01"),
      },
    })

    const response = await POST(makeRequest("POST", { providerId: PROVIDER_ID }))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.providerId).toBe(PROVIDER_ID)
  })
})

describe("GET /api/follows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return followed providers list", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockGetFollowedProviders.mockResolvedValue([
      {
        id: "f1",
        customerId: "u1",
        providerId: "p1",
        createdAt: new Date(),
        provider: { id: "p1", businessName: "Hovslagare AB", profileImageUrl: null },
      },
    ])

    const response = await GET(makeRequest("GET"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].provider.businessName).toBe("Hovslagare AB")
  })
})
