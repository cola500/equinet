/**
 * DELETE /api/native/calendar/exceptions/[date] tests
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
    availabilityException: { delete: vi.fn() },
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

import { DELETE } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockDelete = vi.mocked(prisma.availabilityException.delete)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(date: string) {
  return new NextRequest(
    `http://localhost:3000/api/native/calendar/exceptions/${date}`,
    {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-jwt-token" },
    }
  )
}

const mockProvider = { id: "provider-1" }

const mockDeleteResult = {
  id: "exc-1",
  providerId: "provider-1",
  date: new Date("2026-03-15"),
  isClosed: true,
  startTime: null,
  endTime: null,
  reason: "Semester",
  location: null,
  latitude: null,
  longitude: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("DELETE /api/native/calendar/exceptions/[date]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "bearer" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockDelete.mockResolvedValue(mockDeleteResult as never)
    mockRateLimit.mockResolvedValue(true)
  })

  const params = Promise.resolve({ date: "2026-03-15" })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns 400 for invalid date format", async () => {
    const badParams = Promise.resolve({ date: "not-a-date" })
    const res = await DELETE(createRequest("not-a-date"), { params: badParams })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltigt datumformat")
  })

  it("returns 200 when deleting an exception", async () => {
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Undantag borttaget")
    expect(body.date).toBe("2026-03-15")
  })

  it("returns 404 when exception does not exist (P2025)", async () => {
    const prismaError = Object.assign(new Error("Record not found"), { code: "P2025" })
    mockDelete.mockRejectedValue(prismaError)
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Undantag hittades inte")
  })

  it("returns 500 on unexpected error", async () => {
    mockDelete.mockRejectedValue(new Error("DB error"))
    const res = await DELETE(createRequest("2026-03-15"), { params })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
