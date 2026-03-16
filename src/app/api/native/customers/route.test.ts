/**
 * GET/POST /api/native/customers tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    booking: { groupBy: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn() },
    providerCustomer: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))
vi.mock("@/lib/ghost-user", () => ({
  createGhostUser: vi.fn().mockResolvedValue("ghost-user-1"),
}))
vi.mock("@/lib/sanitize", () => ({
  sanitizeString: vi.fn((s: string) => s),
  sanitizePhone: vi.fn((s: string) => s),
  sanitizeEmail: vi.fn((s: string) => s),
  stripXss: vi.fn((s: string) => s),
}))

import { GET, POST } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { createGhostUser } from "@/lib/ghost-user"

const mockAuth = vi.mocked(authFromMobileToken)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockBookingGroupBy = vi.mocked(prisma.booking.groupBy)
const mockBookingFindMany = vi.mocked(prisma.booking.findMany)
const mockUserFindMany = vi.mocked(prisma.user.findMany)
const mockProviderCustomerFindMany = vi.mocked(prisma.providerCustomer.findMany)
const mockProviderCustomerFindUnique = vi.mocked(prisma.providerCustomer.findUnique)
const mockProviderCustomerCreate = vi.mocked(prisma.providerCustomer.create)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockCreateGhostUser = vi.mocked(createGhostUser)

const mockProvider = { id: "provider-1" }

function createGetRequest(params?: { status?: string; q?: string }) {
  const url = new URL("http://localhost:3000/api/native/customers")
  if (params?.status) url.searchParams.set("status", params.status)
  if (params?.q) url.searchParams.set("q", params.q)
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/customers", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("GET /api/native/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    // Default: no customers
    mockBookingGroupBy.mockResolvedValue([] as never)
    mockBookingFindMany.mockResolvedValue([] as never)
    mockUserFindMany.mockResolvedValue([] as never)
    mockProviderCustomerFindMany.mockResolvedValue([] as never)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createGetRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await GET(createGetRequest())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createGetRequest())
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createGetRequest())
    expect(res.status).toBe(404)
  })

  it("returns empty array when no customers", async () => {
    const res = await GET(createGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.customers).toEqual([])
  })

  it("returns customers with correct fields from bookings", async () => {
    mockBookingGroupBy
      .mockResolvedValueOnce([
        { customerId: "cust-1", _count: { id: 5 }, _max: { bookingDate: new Date("2026-03-01") } },
      ] as never)
      .mockResolvedValueOnce([
        { customerId: "cust-1", _count: { id: 1 } },
      ] as never)
    mockUserFindMany.mockResolvedValue([
      { id: "cust-1", firstName: "Anna", lastName: "Svensson", email: "anna@test.se", phone: "070-1234567" },
    ] as never)
    mockBookingFindMany.mockResolvedValue([
      { customerId: "cust-1", horse: { id: "horse-1", name: "Blansen" } },
    ] as never)
    mockProviderCustomerFindMany.mockResolvedValue([] as never)

    const res = await GET(createGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.customers).toHaveLength(1)
    const c = body.customers[0]
    expect(c.id).toBe("cust-1")
    expect(c.firstName).toBe("Anna")
    expect(c.lastName).toBe("Svensson")
    expect(c.bookingCount).toBe(5)
    expect(c.noShowCount).toBe(1)
    expect(c.horses).toEqual([{ id: "horse-1", name: "Blansen" }])
  })

  it("includes manually added customers", async () => {
    mockProviderCustomerFindMany.mockResolvedValue([
      {
        customerId: "manual-1",
        customer: { id: "manual-1", firstName: "Bo", lastName: "Ek", email: "bo@test.se", phone: null },
      },
    ] as never)

    const res = await GET(createGetRequest())
    const body = await res.json()
    expect(body.customers).toHaveLength(1)
    expect(body.customers[0].firstName).toBe("Bo")
    expect(body.customers[0].isManuallyAdded).toBe(true)
  })

  it("filters by search query", async () => {
    mockProviderCustomerFindMany.mockResolvedValue([
      {
        customerId: "c-1",
        customer: { id: "c-1", firstName: "Anna", lastName: "Svensson", email: "anna@test.se", phone: null },
      },
      {
        customerId: "c-2",
        customer: { id: "c-2", firstName: "Bo", lastName: "Ek", email: "bo@test.se", phone: null },
      },
    ] as never)

    const res = await GET(createGetRequest({ q: "anna" }))
    const body = await res.json()
    expect(body.customers).toHaveLength(1)
    expect(body.customers[0].firstName).toBe("Anna")
  })

  it("returns 500 on unexpected error", async () => {
    mockBookingGroupBy.mockRejectedValue(new Error("DB error"))
    const res = await GET(createGetRequest())
    expect(res.status).toBe(500)
  })
})

describe("POST /api/native/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockCreateGhostUser.mockResolvedValue("ghost-user-1")
    mockProviderCustomerFindUnique.mockResolvedValue(null)
    mockProviderCustomerCreate.mockResolvedValue({ id: "link-1" } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createPostRequest({ firstName: "Test" }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createPostRequest({ firstName: "Test" }))
    expect(res.status).toBe(429)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/customers", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt-token", "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing firstName", async () => {
    const res = await POST(createPostRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 for extra fields (strict)", async () => {
    const res = await POST(createPostRequest({ firstName: "Test", unknownField: "hack" }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when customer already exists", async () => {
    mockProviderCustomerFindUnique.mockResolvedValue({ id: "existing" } as never)
    const res = await POST(createPostRequest({ firstName: "Test" }))
    expect(res.status).toBe(409)
  })

  it("creates customer and returns 201", async () => {
    const res = await POST(createPostRequest({ firstName: "Anna", lastName: "Svensson", phone: "070-123" }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.customer.id).toBe("ghost-user-1")
    expect(mockCreateGhostUser).toHaveBeenCalledWith({
      firstName: "Anna",
      lastName: "Svensson",
      phone: "070-123",
      email: undefined,
    })
  })

  it("returns 500 on unexpected error", async () => {
    mockCreateGhostUser.mockRejectedValue(new Error("DB error"))
    const res = await POST(createPostRequest({ firstName: "Test" }))
    expect(res.status).toBe(500)
  })
})
