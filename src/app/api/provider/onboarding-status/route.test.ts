import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }))

import { GET } from "./route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

function mockRequest() {
  return new NextRequest("http://localhost:3000/api/provider/onboarding-status")
}

const mockAuth = vi.mocked(auth)
const mockFindFirst = vi.mocked(prisma.provider.findFirst)

function makeProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: "provider-1",
    businessName: "Test Hovslager",
    description: "Basta hovslageriet",
    address: "Testgatan 1",
    city: "Stockholm",
    postalCode: "11122",
    latitude: 59.33,
    longitude: 18.07,
    isActive: true,
    services: [{ id: "service-1" }],
    availability: [{ id: "avail-1" }],
    ...overrides,
  }
}

describe("GET /api/provider/onboarding-status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1" },
    } as never)
    mockFindFirst.mockResolvedValue(makeProvider() as never)
  })

  // --- Auth ---

  it("returns 401 when session is null", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await GET(mockRequest())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 401 when session.user.id is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} } as never)

    const res = await GET(mockRequest())

    expect(res.status).toBe(401)
  })

  // --- Provider not found ---

  it("returns 404 when provider not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const res = await GET(mockRequest())

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  // --- Completion booleans ---

  it("returns all false when profile is incomplete and no services/availability/no location", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({
        description: null,
        address: null,
        city: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        services: [],
        availability: [],
      }) as never
    )

    const res = await GET(mockRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      profileComplete: false,
      hasServices: false,
      hasAvailability: false,
      hasServiceArea: false,
      allComplete: false,
    })
  })

  it("does not include isActive in response", async () => {
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data).not.toHaveProperty("isActive")
  })

  it("returns profileComplete=true when profile fields filled (excluding lat/lng)", async () => {
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.profileComplete).toBe(true)
  })

  it("returns profileComplete=true even when latitude/longitude null", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({ latitude: null, longitude: null }) as never
    )

    const res = await GET(mockRequest())
    const data = await res.json()

    // profileComplete no longer checks lat/lng -- that's hasServiceArea
    expect(data.profileComplete).toBe(true)
  })

  it("returns profileComplete=false when description missing", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({ description: null }) as never
    )

    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.profileComplete).toBe(false)
  })

  it("returns hasServiceArea=false when latitude/longitude null", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({ latitude: null, longitude: null }) as never
    )

    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.hasServiceArea).toBe(false)
  })

  it("returns hasServiceArea=true when latitude/longitude set", async () => {
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.hasServiceArea).toBe(true)
  })

  it("returns hasServices=true when at least one active service", async () => {
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.hasServices).toBe(true)
  })

  it("returns hasAvailability=true when at least one active availability", async () => {
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.hasAvailability).toBe(true)
  })

  it("returns allComplete=true when everything is complete", async () => {
    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data).toEqual({
      profileComplete: true,
      hasServices: true,
      hasAvailability: true,
      hasServiceArea: true,
      allComplete: true,
    })
  })

  it("returns allComplete=false when hasServiceArea is false", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({ latitude: null, longitude: null }) as never
    )

    const res = await GET(mockRequest())
    const data = await res.json()

    expect(data.allComplete).toBe(false)
    expect(data.hasServiceArea).toBe(false)
    expect(data.profileComplete).toBe(true)
  })
})
