/**
 * GET/POST /api/native/customers/[customerId]/notes tests
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
    providerCustomerNote: { findMany: vi.fn(), create: vi.fn() },
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
  sanitizeMultilineString: vi.fn((s: string) => s),
  stripXss: vi.fn((s: string) => s),
}))

import { GET, POST } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { hasCustomerRelationship } from "@/lib/customer-relationship"

const mockAuth = vi.mocked(authFromMobileToken)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindNotes = vi.mocked(prisma.providerCustomerNote.findMany)
const mockCreateNote = vi.mocked(prisma.providerCustomerNote.create)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockHasRelation = vi.mocked(hasCustomerRelationship)

const mockProvider = { id: "provider-1" }
const routeContext = { params: Promise.resolve({ customerId: "cust-1" }) }

function createGetRequest() {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/notes", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/notes", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("GET /api/native/customers/[customerId]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockHasRelation.mockResolvedValue(true)
    mockFindNotes.mockResolvedValue([] as never)
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

  it("returns notes on success", async () => {
    mockFindNotes.mockResolvedValue([
      { id: "note-1", content: "Bra kund", createdAt: new Date("2026-03-01"), updatedAt: new Date("2026-03-01") },
    ] as never)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notes).toHaveLength(1)
    expect(body.notes[0].content).toBe("Bra kund")
  })

  it("returns 500 on unexpected error", async () => {
    mockFindNotes.mockRejectedValue(new Error("DB error"))
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(500)
  })
})

describe("POST /api/native/customers/[customerId]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockHasRelation.mockResolvedValue(true)
    mockCreateNote.mockResolvedValue({
      id: "note-new", content: "Ny anteckning", createdAt: new Date(), updatedAt: new Date(),
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createPostRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/customers/cust-1/notes", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt-token", "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await POST(req, routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for empty content", async () => {
    const res = await POST(createPostRequest({ content: "" }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for extra fields (strict)", async () => {
    const res = await POST(createPostRequest({ content: "Test", hack: true }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 403 when no customer relationship", async () => {
    mockHasRelation.mockResolvedValue(false)
    const res = await POST(createPostRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(403)
  })

  it("creates note and returns 201", async () => {
    const res = await POST(createPostRequest({ content: "Bra ryttare" }), routeContext)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("note-new")
  })

  it("returns 500 on unexpected error", async () => {
    mockCreateNote.mockRejectedValue(new Error("DB error"))
    const res = await POST(createPostRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(500)
  })
})
