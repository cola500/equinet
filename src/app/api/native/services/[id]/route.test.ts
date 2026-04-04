/**
 * PUT/DELETE /api/native/services/[id] tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const { mockUpdateWithAuth, mockDeleteWithAuth } = vi.hoisted(() => ({
  mockUpdateWithAuth: vi.fn(),
  mockDeleteWithAuth: vi.fn(),
}))

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
  },
}))
vi.mock("@/infrastructure/persistence/service/ServiceRepository", () => ({
  ServiceRepository: class MockServiceRepository {
    updateWithAuth = mockUpdateWithAuth
    deleteWithAuth = mockDeleteWithAuth
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
const mockRateLimit = vi.mocked(rateLimiters.api)

const mockProvider = { id: "provider-1" }
const serviceId = "service-1"

type RouteContext = { params: Promise<{ id: string }> }

function createContext(id: string = serviceId): RouteContext {
  return { params: Promise.resolve({ id }) }
}

function createPutRequest(body: unknown) {
  return new NextRequest(`http://localhost:3000/api/native/services/${serviceId}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest() {
  return new NextRequest(`http://localhost:3000/api/native/services/${serviceId}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

describe("PUT /api/native/services/[id]", () => {
  const validBody = {
    name: "Hovvård uppdaterad",
    price: 1500,
    durationMinutes: 90,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockUpdateWithAuth.mockResolvedValue({
      id: serviceId,
      providerId: "provider-1",
      ...validBody,
      description: null,
      isActive: true,
      recommendedIntervalWeeks: null,
    })
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PUT(createPutRequest(validBody), createContext())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await PUT(createPutRequest(validBody), createContext())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter throws RateLimitServiceError", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis down"))
    const res = await PUT(createPutRequest(validBody), createContext())
    expect(res.status).toBe(503)
  })

  it("returns 400 on invalid JSON", async () => {
    const req = new NextRequest(`http://localhost:3000/api/native/services/${serviceId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-jwt-token",
        "Content-Type": "application/json",
      },
      body: "not json",
    })
    const res = await PUT(req, createContext())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 on validation error", async () => {
    const res = await PUT(createPutRequest({ price: -1 }), createContext())
    expect(res.status).toBe(400)
  })

  it("returns 400 on unknown fields (.strict())", async () => {
    const res = await PUT(createPutRequest({ ...validBody, hack: true }), createContext())
    expect(res.status).toBe(400)
  })

  it("returns 404 when service not found or not owned (IDOR)", async () => {
    mockUpdateWithAuth.mockResolvedValue(null)
    const res = await PUT(createPutRequest(validBody), createContext())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Tjänsten hittades inte")
  })

  it("updates service and returns 200", async () => {
    const res = await PUT(createPutRequest(validBody), createContext())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.service.name).toBe("Hovvård uppdaterad")
    expect(mockUpdateWithAuth).toHaveBeenCalledWith(
      serviceId,
      expect.objectContaining({ name: "Hovvård uppdaterad", price: 1500 }),
      "provider-1"
    )
  })
})

describe("DELETE /api/native/services/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockDeleteWithAuth.mockResolvedValue(true)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), createContext())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await DELETE(createDeleteRequest(), createContext())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter throws RateLimitServiceError", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis down"))
    const res = await DELETE(createDeleteRequest(), createContext())
    expect(res.status).toBe(503)
  })

  it("returns 404 when service not found or not owned (IDOR)", async () => {
    mockDeleteWithAuth.mockResolvedValue(false)
    const res = await DELETE(createDeleteRequest(), createContext())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Tjänsten hittades inte")
  })

  it("deletes service and returns 200", async () => {
    const res = await DELETE(createDeleteRequest(), createContext())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Tjänsten har tagits bort")
    expect(mockDeleteWithAuth).toHaveBeenCalledWith(serviceId, "provider-1")
  })
})
