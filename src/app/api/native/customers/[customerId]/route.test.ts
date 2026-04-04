/**
 * PUT/DELETE /api/native/customers/[customerId] tests
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
    providerCustomer: { findUnique: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    booking: { count: vi.fn() },
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

import { PUT, DELETE } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindLink = vi.mocked(prisma.providerCustomer.findUnique)
const mockDeleteLink = vi.mocked(prisma.providerCustomer.delete)
const mockUpdateUser = vi.mocked(prisma.user.update)
const mockFindUser = vi.mocked(prisma.user.findUnique)
const mockDeleteUser = vi.mocked(prisma.user.delete)
const mockBookingCount = vi.mocked(prisma.booking.count)
const mockRateLimit = vi.mocked(rateLimiters.api)

const mockProvider = { id: "provider-1" }
const routeContext = { params: Promise.resolve({ customerId: "cust-1" }) }

function createPutRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1", {
    method: "PUT",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest() {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1", {
    method: "DELETE",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

describe("PUT /api/native/customers/[customerId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockFindLink.mockResolvedValue({ id: "link-1" } as never)
    mockUpdateUser.mockResolvedValue({
      id: "cust-1", firstName: "Updated", lastName: "Name", email: "up@test.se", phone: null,
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ firstName: "Test" }), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await PUT(createPutRequest({ firstName: "Test" }), routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await PUT(createPutRequest({ firstName: "Test" }), routeContext)
    expect(res.status).toBe(503)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/customers/cust-1", {
      method: "PUT",
      headers: { Authorization: "Bearer valid-jwt-token", "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await PUT(req, routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing firstName", async () => {
    const res = await PUT(createPutRequest({}), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for extra fields (strict)", async () => {
    const res = await PUT(createPutRequest({ firstName: "A", hack: true }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ firstName: "Test" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 404 when customer not linked to provider", async () => {
    mockFindLink.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ firstName: "Test" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("updates customer and returns 200", async () => {
    const res = await PUT(createPutRequest({ firstName: "Anna", lastName: "Ek" }), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("cust-1")
    expect(mockUpdateUser).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cust-1" },
    }))
  })

  it("returns 500 on unexpected error", async () => {
    mockUpdateUser.mockRejectedValue(new Error("DB error"))
    const res = await PUT(createPutRequest({ firstName: "Test" }), routeContext)
    expect(res.status).toBe(500)
  })
})

describe("DELETE /api/native/customers/[customerId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockFindLink.mockResolvedValue({ id: "link-1" } as never)
    mockDeleteLink.mockResolvedValue({ id: "link-1" } as never)
    mockBookingCount.mockResolvedValue(0)
    mockFindUser.mockResolvedValue({ id: "cust-1", isManualCustomer: true } as never)
    mockDeleteUser.mockResolvedValue({} as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 404 when customer not linked to provider", async () => {
    mockFindLink.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("deletes customer link and cleans up ghost user", async () => {
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Kunden har tagits bort")
    expect(mockDeleteLink).toHaveBeenCalled()
    expect(mockDeleteUser).toHaveBeenCalledWith({ where: { id: "cust-1" } })
  })

  it("does not delete user when bookings exist", async () => {
    mockBookingCount.mockResolvedValue(3)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(200)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it("does not delete non-manual user", async () => {
    mockFindUser.mockResolvedValue({ id: "cust-1", isManualCustomer: false } as never)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(200)
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected error", async () => {
    mockDeleteLink.mockRejectedValue(new Error("DB error"))
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(500)
  })
})
