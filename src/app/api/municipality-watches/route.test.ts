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

// Mock the service via its factory
const mockAddWatch = vi.fn()
const mockGetWatches = vi.fn()

vi.mock("@/domain/municipality-watch/MunicipalityWatchServiceFactory", () => ({
  createMunicipalityWatchService: () => ({
    addWatch: mockAddWatch,
    getWatches: mockGetWatches,
  }),
}))

function makeRequest(method: string, body?: object) {
  return new NextRequest("http://localhost:3000/api/municipality-watches", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("POST /api/municipality-watches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not logged in", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))
    expect(response.status).toBe(401)
  })

  it("should return 403 when user is not a customer", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "provider" },
    } as any)

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))
    expect(response.status).toBe(403)
  })

  it("should return 404 when feature flag is disabled", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))
    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const request = new NextRequest("http://localhost:3000/api/municipality-watches", {
      method: "POST",
      body: "not json",
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("should return 400 for missing municipality", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const response = await POST(makeRequest("POST", {
      serviceTypeName: "Hovslagning",
    }))
    expect(response.status).toBe(400)
  })

  it("should return 400 for extra fields (.strict())", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
      extraField: "bad",
    }))
    expect(response.status).toBe(400)
  })

  it("should return 400 for INVALID_MUNICIPALITY", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAddWatch.mockResolvedValue({ ok: false, error: "INVALID_MUNICIPALITY" })

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig kommun")
  })

  it("should return 400 for MAX_WATCHES_REACHED", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAddWatch.mockResolvedValue({ ok: false, error: "MAX_WATCHES_REACHED" })

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Max antal bevakningar uppnått (10)")
  })

  it("should return 201 on success", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAddWatch.mockResolvedValue({
      ok: true,
      value: {
        id: "w1",
        customerId: "u1",
        municipality: "Kungsbacka",
        serviceTypeName: "Hovslagning",
        createdAt: new Date("2026-01-01"),
      },
    })

    const response = await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.municipality).toBe("Kungsbacka")
    expect(data.serviceTypeName).toBe("Hovslagning")
  })

  it("should use customerId from session, not from body", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "session-user", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAddWatch.mockResolvedValue({ ok: true, value: { id: "w1" } })

    await POST(makeRequest("POST", {
      municipality: "Kungsbacka",
      serviceTypeName: "Hovslagning",
    }))

    expect(mockAddWatch).toHaveBeenCalledWith(
      "session-user",
      "Kungsbacka",
      "Hovslagning"
    )
  })
})

describe("GET /api/municipality-watches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return customer's watches", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "customer" },
    } as any)
    const { isFeatureEnabled } = await import("@/lib/feature-flags")
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockGetWatches.mockResolvedValue([
      {
        id: "w1",
        customerId: "u1",
        municipality: "Kungsbacka",
        serviceTypeName: "Hovslagning",
        createdAt: new Date(),
      },
    ])

    const response = await GET(makeRequest("GET"))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].municipality).toBe("Kungsbacka")
  })

  it("should return 403 for non-customer", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", userType: "provider" },
    } as any)

    const response = await GET(makeRequest("GET"))
    expect(response.status).toBe(403)
  })
})
