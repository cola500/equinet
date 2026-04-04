/**
 * GET/POST /api/native/customers/[customerId]/horses tests
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
    horse: { findMany: vi.fn(), create: vi.fn() },
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

import { GET, POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { hasCustomerRelationship } from "@/lib/customer-relationship"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindHorses = vi.mocked(prisma.horse.findMany)
const mockCreateHorse = vi.mocked(prisma.horse.create)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockHasRelation = vi.mocked(hasCustomerRelationship)

const mockProvider = { id: "provider-1" }
const routeContext = { params: Promise.resolve({ customerId: "cust-1" }) }

function createGetRequest() {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/horses", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/horses", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("GET /api/native/customers/[customerId]/horses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockHasRelation.mockResolvedValue(true)
    mockFindHorses.mockResolvedValue([] as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 403 when no customer relationship", async () => {
    mockHasRelation.mockResolvedValue(false)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(403)
  })

  it("returns horses on success", async () => {
    mockFindHorses.mockResolvedValue([
      { id: "h-1", name: "Blansen", breed: "Halvblod", birthYear: 2015, color: "Brun", gender: "mare", specialNeeds: null, registrationNumber: null, microchipNumber: null },
    ] as never)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horses).toHaveLength(1)
    expect(body.horses[0].name).toBe("Blansen")
  })

  it("returns 500 on unexpected error", async () => {
    mockFindHorses.mockRejectedValue(new Error("DB error"))
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(500)
  })
})

describe("POST /api/native/customers/[customerId]/horses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockHasRelation.mockResolvedValue(true)
    mockCreateHorse.mockResolvedValue({
      id: "h-new", name: "Nyansen", breed: null, birthYear: null, color: null, gender: null,
      specialNeeds: null, registrationNumber: null, microchipNumber: null,
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createPostRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/customers/cust-1/horses", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt-token", "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req, routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing name", async () => {
    const res = await POST(createPostRequest({}), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for extra fields (strict)", async () => {
    const res = await POST(createPostRequest({ name: "Test", hack: true }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 403 when no customer relationship", async () => {
    mockHasRelation.mockResolvedValue(false)
    const res = await POST(createPostRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(403)
  })

  it("creates horse and returns 201", async () => {
    const res = await POST(createPostRequest({ name: "Nyansen", breed: "Arabisk fullblod" }), routeContext)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("h-new")
  })

  it("returns 500 on unexpected error", async () => {
    mockCreateHorse.mockRejectedValue(new Error("DB error"))
    const res = await POST(createPostRequest({ name: "Test" }), routeContext)
    expect(res.status).toBe(500)
  })
})
