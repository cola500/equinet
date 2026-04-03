/**
 * PUT/DELETE /api/native/customers/[customerId]/horses/[horseId] tests
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
    provider: { findUnique: vi.fn() },
    horse: { findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
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
vi.mock("@/lib/customer-relationship", () => ({
  hasCustomerRelationship: vi.fn().mockResolvedValue(true),
}))
vi.mock("@/lib/sanitize", () => ({
  sanitizeString: vi.fn((s: string) => s),
  stripXss: vi.fn((s: string) => s),
}))

import { PUT, DELETE } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { hasCustomerRelationship } from "@/lib/customer-relationship"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindHorse = vi.mocked(prisma.horse.findFirst)
const mockUpdateMany = vi.mocked(prisma.horse.updateMany)
const mockFindUpdated = vi.mocked(prisma.horse.findUnique)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockHasRelation = vi.mocked(hasCustomerRelationship)

const mockProvider = { id: "provider-1" }
const routeContext = { params: Promise.resolve({ customerId: "cust-1", horseId: "horse-1" }) }

const mockHorseData = {
  id: "horse-1", name: "Blansen", breed: "Halvblod", birthYear: 2015,
  color: "Brun", gender: "mare", specialNeeds: null, registrationNumber: null, microchipNumber: null,
}

function createPutRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/horses/horse-1", {
    method: "PUT",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest() {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/horses/horse-1", {
    method: "DELETE",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

describe("PUT /api/native/customers/[customerId]/horses/[horseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "bearer" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockHasRelation.mockResolvedValue(true)
    mockFindHorse.mockResolvedValue({ id: "horse-1" } as never)
    mockUpdateMany.mockResolvedValue({ count: 1 } as never)
    mockFindUpdated.mockResolvedValue(mockHorseData as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await PUT(createPutRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/customers/cust-1/horses/horse-1", {
      method: "PUT",
      headers: { Authorization: "Bearer valid-jwt-token", "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await PUT(req, routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for extra fields (strict)", async () => {
    const res = await PUT(createPutRequest({ name: "Test", hack: true }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 403 when no customer relationship", async () => {
    mockHasRelation.mockResolvedValue(false)
    const res = await PUT(createPutRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(403)
  })

  it("returns 404 when horse not found", async () => {
    mockFindHorse.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("updates horse and returns 200", async () => {
    const res = await PUT(createPutRequest({ name: "Nytt Namn" }), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("horse-1")
  })

  it("returns 500 on unexpected error", async () => {
    mockUpdateMany.mockRejectedValue(new Error("DB error"))
    const res = await PUT(createPutRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(500)
  })
})

describe("DELETE /api/native/customers/[customerId]/horses/[horseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "bearer" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockHasRelation.mockResolvedValue(true)
    mockFindHorse.mockResolvedValue({ id: "horse-1" } as never)
    mockUpdateMany.mockResolvedValue({ count: 1 } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 403 when no customer relationship", async () => {
    mockHasRelation.mockResolvedValue(false)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(403)
  })

  it("returns 404 when horse not found", async () => {
    mockFindHorse.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("soft-deletes horse and returns success message", async () => {
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Hästen har tagits bort")
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { isActive: false },
    }))
  })

  it("returns 500 on unexpected error", async () => {
    mockUpdateMany.mockRejectedValue(new Error("DB error"))
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(500)
  })
})
