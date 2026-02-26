import { describe, it, expect, beforeEach, vi } from "vitest"

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

    const res = await GET()

    expect(res.status).toBe(401)
    expect(await res.text()).toBe("Unauthorized")
  })

  it("returns 401 when session.user.id is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} } as never)

    const res = await GET()

    expect(res.status).toBe(401)
  })

  // --- Provider not found ---

  it("returns 404 when provider not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const res = await GET()

    expect(res.status).toBe(404)
    expect(await res.text()).toBe("Provider not found")
  })

  // --- Completion booleans ---

  it("returns all false when profile is incomplete and no services/availability/inactive", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({
        description: null,
        address: null,
        city: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        isActive: false,
        services: [],
        availability: [],
      }) as never
    )

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      profileComplete: false,
      hasServices: false,
      hasAvailability: false,
      isActive: false,
      allComplete: false,
    })
  })

  it("returns profileComplete=true when all profile fields filled", async () => {
    const res = await GET()
    const data = await res.json()

    expect(data.profileComplete).toBe(true)
  })

  it("returns profileComplete=false when description missing", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({ description: null }) as never
    )

    const res = await GET()
    const data = await res.json()

    expect(data.profileComplete).toBe(false)
  })

  it("returns profileComplete=false when latitude/longitude null", async () => {
    mockFindFirst.mockResolvedValueOnce(
      makeProvider({ latitude: null, longitude: null }) as never
    )

    const res = await GET()
    const data = await res.json()

    expect(data.profileComplete).toBe(false)
  })

  it("returns hasServices=true when at least one active service", async () => {
    const res = await GET()
    const data = await res.json()

    expect(data.hasServices).toBe(true)
  })

  it("returns hasAvailability=true when at least one active availability", async () => {
    const res = await GET()
    const data = await res.json()

    expect(data.hasAvailability).toBe(true)
  })

  it("returns allComplete=true when everything is complete", async () => {
    const res = await GET()
    const data = await res.json()

    expect(data).toEqual({
      profileComplete: true,
      hasServices: true,
      hasAvailability: true,
      isActive: true,
      allComplete: true,
    })
  })
})
