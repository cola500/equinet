/**
 * PUT/DELETE /api/native/customers/[customerId]/notes/[noteId] tests
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
    providerCustomerNote: { update: vi.fn(), delete: vi.fn() },
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
vi.mock("@/lib/sanitize", () => ({
  sanitizeMultilineString: vi.fn((s: string) => s),
  stripXss: vi.fn((s: string) => s),
}))

import { PUT, DELETE } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(authFromMobileToken)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockUpdateNote = vi.mocked(prisma.providerCustomerNote.update)
const mockDeleteNote = vi.mocked(prisma.providerCustomerNote.delete)
const mockRateLimit = vi.mocked(rateLimiters.api)

const mockProvider = { id: "provider-1" }
const routeContext = { params: Promise.resolve({ customerId: "cust-1", noteId: "note-1" }) }

function createPutRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/notes/note-1", {
    method: "PUT",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest() {
  return new NextRequest("http://localhost:3000/api/native/customers/cust-1/notes/note-1", {
    method: "DELETE",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

describe("PUT /api/native/customers/[customerId]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockUpdateNote.mockResolvedValue({
      id: "note-1", content: "Updated", createdAt: new Date(), updatedAt: new Date(),
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await PUT(createPutRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await PUT(createPutRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(503)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/customers/cust-1/notes/note-1", {
      method: "PUT",
      headers: { Authorization: "Bearer valid-jwt-token", "Content-Type": "application/json" },
      body: "not json",
    })
    const res = await PUT(req, routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for empty content", async () => {
    const res = await PUT(createPutRequest({ content: "" }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 400 for extra fields (strict)", async () => {
    const res = await PUT(createPutRequest({ content: "Test", hack: true }), routeContext)
    expect(res.status).toBe(400)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await PUT(createPutRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 404 when note not found (Prisma error)", async () => {
    mockUpdateNote.mockRejectedValue(new Error("Record to update not found"))
    const res = await PUT(createPutRequest({ content: "Test" }), routeContext)
    expect(res.status).toBe(404)
  })

  it("updates note and returns 200", async () => {
    const res = await PUT(createPutRequest({ content: "Uppdaterad anteckning" }), routeContext)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("note-1")
    expect(mockUpdateNote).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "note-1", providerId: "provider-1" },
    }))
  })
})

describe("DELETE /api/native/customers/[customerId]/notes/[noteId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockRateLimit.mockResolvedValue(true)
    mockDeleteNote.mockResolvedValue({} as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(401)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 404 when note not found", async () => {
    mockDeleteNote.mockRejectedValue(new Error("Record to delete not found"))
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("deletes note and returns 204", async () => {
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(204)
    expect(mockDeleteNote).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "note-1", providerId: "provider-1" },
    }))
  })

  it("returns 500 on unexpected error", async () => {
    mockRateLimit.mockRejectedValue(new Error("Unexpected"))
    const res = await DELETE(createDeleteRequest(), routeContext)
    expect(res.status).toBe(500)
  })
})
