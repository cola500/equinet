/**
 * GET/PUT /api/native/provider/profile tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
    profileUpdate: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))
vi.mock("@/lib/cache/provider-cache", () => ({
  invalidateProviderCache: vi.fn().mockResolvedValue(undefined),
}))

import { GET, PUT } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockRateLimitApi = vi.mocked(rateLimiters.api)
const mockRateLimitProfile = vi.mocked(rateLimiters.profileUpdate)

const mockProfileData = {
  id: "provider-1",
  businessName: "Hovslageriet AB",
  description: "Erfaren hovslagare",
  address: "Storgatan 1",
  city: "Stockholm",
  postalCode: "11122",
  serviceArea: "Stockholms län",
  latitude: 59.3293,
  longitude: 18.0686,
  serviceAreaKm: 50,
  profileImageUrl: null,
  isActive: true,
  acceptingNewCustomers: true,
  rescheduleEnabled: true,
  rescheduleWindowHours: 24,
  maxReschedules: 2,
  rescheduleRequiresApproval: false,
  recurringEnabled: true,
  maxSeriesOccurrences: 12,
  isVerified: false,
  user: {
    firstName: "Erik",
    lastName: "Svensson",
    email: "erik@example.com",
    phone: "0701234567",
  },
}

function createGetRequest() {
  return new NextRequest("http://localhost:3000/api/native/provider/profile", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

function createPutRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/provider/profile", {
    method: "PUT",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("GET /api/native/provider/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProfileData as never)
    mockRateLimitApi.mockResolvedValue(true)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createGetRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimitApi.mockResolvedValue(false)
    const res = await GET(createGetRequest())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter throws RateLimitServiceError", async () => {
    mockRateLimitApi.mockRejectedValue(new RateLimitServiceError("Redis down"))
    const res = await GET(createGetRequest())
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null as never)
    const res = await GET(createGetRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantörsprofil hittades inte")
  })

  it("returns provider profile with user data", async () => {
    const res = await GET(createGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("provider-1")
    expect(body.businessName).toBe("Hovslageriet AB")
    expect(body.user.firstName).toBe("Erik")
    expect(body.user.email).toBe("erik@example.com")
    expect(body.isVerified).toBe(false)
  })
})

describe("PUT /api/native/provider/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockRateLimitProfile.mockResolvedValue(true)
    mockTransaction.mockResolvedValue(mockProfileData as never)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ businessName: "Nytt namn" }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimitProfile.mockResolvedValue(false)
    const res = await PUT(createPutRequest({ businessName: "Nytt namn" }))
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter throws RateLimitServiceError", async () => {
    mockRateLimitProfile.mockRejectedValue(
      new RateLimitServiceError("Redis down")
    )
    const res = await PUT(createPutRequest({ businessName: "Nytt namn" }))
    expect(res.status).toBe(503)
  })

  it("returns 400 on invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/native/provider/profile",
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer valid-jwt-token",
          "Content-Type": "application/json",
        },
        body: "not json",
      }
    )
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 on Zod validation error (empty businessName)", async () => {
    const res = await PUT(createPutRequest({ businessName: "" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 on unknown fields (.strict())", async () => {
    const res = await PUT(
      createPutRequest({ businessName: "Test", hack: true })
    )
    expect(res.status).toBe(400)
  })

  it("updates provider fields successfully", async () => {
    const updateData = {
      businessName: "Nytt Företag AB",
      description: "Ny beskrivning",
      city: "Göteborg",
    }
    const updatedProfile = {
      ...mockProfileData,
      ...updateData,
    }
    mockTransaction.mockResolvedValue(updatedProfile as never)

    const res = await PUT(createPutRequest(updateData))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businessName).toBe("Nytt Företag AB")
    expect(body.city).toBe("Göteborg")
  })

  it("updates user fields (firstName, lastName, phone)", async () => {
    const updateData = {
      firstName: "Anna",
      lastName: "Johansson",
      phone: "0709876543",
    }
    const updatedProfile = {
      ...mockProfileData,
      user: { ...mockProfileData.user, ...updateData },
    }
    mockTransaction.mockResolvedValue(updatedProfile as never)

    const res = await PUT(createPutRequest(updateData))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.firstName).toBe("Anna")
    expect(body.user.lastName).toBe("Johansson")
    expect(body.user.phone).toBe("0709876543")
  })

  it("updates settings (acceptingNewCustomers, reschedule, recurring)", async () => {
    const updateData = {
      acceptingNewCustomers: false,
      rescheduleEnabled: false,
      recurringEnabled: false,
      maxSeriesOccurrences: 6,
    }
    const updatedProfile = {
      ...mockProfileData,
      ...updateData,
    }
    mockTransaction.mockResolvedValue(updatedProfile as never)

    const res = await PUT(createPutRequest(updateData))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.acceptingNewCustomers).toBe(false)
    expect(body.rescheduleEnabled).toBe(false)
    expect(body.recurringEnabled).toBe(false)
    expect(body.maxSeriesOccurrences).toBe(6)
  })

  it("handles mixed provider + user fields in single request", async () => {
    const updateData = {
      businessName: "Kombinerat AB",
      firstName: "Kalle",
      phone: "0701111111",
    }
    const updatedProfile = {
      ...mockProfileData,
      businessName: "Kombinerat AB",
      user: { ...mockProfileData.user, firstName: "Kalle", phone: "0701111111" },
    }
    mockTransaction.mockResolvedValue(updatedProfile as never)

    const res = await PUT(createPutRequest(updateData))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businessName).toBe("Kombinerat AB")
    expect(body.user.firstName).toBe("Kalle")
  })

  it("returns 500 on database error", async () => {
    mockTransaction.mockRejectedValue(new Error("Database connection failed"))
    const res = await PUT(createPutRequest({ businessName: "Test" }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Kunde inte uppdatera profil")
  })
})
