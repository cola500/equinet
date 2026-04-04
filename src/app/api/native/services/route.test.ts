/**
 * GET/POST /api/native/services tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const { mockFindByProviderId, mockSave } = vi.hoisted(() => ({
  mockFindByProviderId: vi.fn(),
  mockSave: vi.fn(),
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
    findByProviderId = mockFindByProviderId
    save = mockSave
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
    serviceCreate: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

import { GET, POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockRateLimitApi = vi.mocked(rateLimiters.api)
const mockRateLimitCreate = vi.mocked(rateLimiters.serviceCreate)

const mockProvider = { id: "provider-1" }

function createGetRequest() {
  return new NextRequest("http://localhost:3000/api/native/services", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/services", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("GET /api/native/services", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimitApi.mockResolvedValue(true)
    mockFindByProviderId.mockResolvedValue([])
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
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns services list", async () => {
    const services = [
      {
        id: "s1",
        name: "Hovvård",
        description: "Beskrivning",
        price: 1200,
        durationMinutes: 60,
        isActive: true,
        recommendedIntervalWeeks: 8,
      },
    ]
    mockFindByProviderId.mockResolvedValue(services)

    const res = await GET(createGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.services).toHaveLength(1)
    expect(body.services[0].name).toBe("Hovvård")
    expect(mockFindByProviderId).toHaveBeenCalledWith("provider-1")
  })

  it("returns empty list when no services", async () => {
    mockFindByProviderId.mockResolvedValue([])
    const res = await GET(createGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.services).toHaveLength(0)
  })
})

describe("POST /api/native/services", () => {
  const validBody = {
    name: "Hovvård",
    price: 1200,
    durationMinutes: 60,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimitCreate.mockResolvedValue(true)
    mockSave.mockResolvedValue({ id: "new-service-1", ...validBody })
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimitCreate.mockResolvedValue(false)
    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(429)
  })

  it("returns 400 on invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/services", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-jwt-token",
        "Content-Type": "application/json",
      },
      body: "not json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 on validation error (missing name)", async () => {
    const res = await POST(createPostRequest({ price: 1200, durationMinutes: 60 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 on unknown fields (.strict())", async () => {
    const res = await POST(createPostRequest({ ...validBody, hack: true }))
    expect(res.status).toBe(400)
  })

  it("creates service and returns 201", async () => {
    mockSave.mockResolvedValue({
      id: "new-s1",
      providerId: "provider-1",
      ...validBody,
      description: null,
      isActive: true,
      recommendedIntervalWeeks: null,
    })

    const res = await POST(createPostRequest(validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.service.id).toBe("new-s1")
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "provider-1",
        name: "Hovvård",
        price: 1200,
        durationMinutes: 60,
        isActive: true,
      })
    )
  })

  it("creates service with optional fields", async () => {
    const fullBody = {
      ...validBody,
      description: "Komplett hovvård",
      isActive: false,
      recommendedIntervalWeeks: 8,
    }
    mockSave.mockResolvedValue({
      id: "new-s2",
      providerId: "provider-1",
      ...fullBody,
    })

    const res = await POST(createPostRequest(fullBody))
    expect(res.status).toBe(201)
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Komplett hovvård",
        isActive: false,
        recommendedIntervalWeeks: 8,
      })
    )
  })
})
