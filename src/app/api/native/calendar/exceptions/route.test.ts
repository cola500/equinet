/**
 * POST /api/native/calendar/exceptions tests
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
    availabilityException: { upsert: vi.fn() },
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

import { POST } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(authFromMobileToken)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockUpsert = vi.mocked(prisma.availabilityException.upsert)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/native/calendar/exceptions", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function createInvalidJsonRequest() {
  return new NextRequest("http://localhost:3000/api/native/calendar/exceptions", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: "not-json",
  })
}

const mockProvider = { id: "provider-1" }

const mockUpsertResult = {
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

describe("POST /api/native/calendar/exceptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockUpsert.mockResolvedValue(mockUpsertResult as never)
    mockRateLimit.mockResolvedValue(true)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createRequest({ date: "2026-03-15", isClosed: true }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest({ date: "2026-03-15", isClosed: true }))
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await POST(createRequest({ date: "2026-03-15", isClosed: true }))
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await POST(createRequest({ date: "2026-03-15", isClosed: true }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(createInvalidJsonRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 for invalid date format", async () => {
    const res = await POST(createRequest({ date: "not-a-date", isClosed: true }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 when not closed but missing startTime/endTime", async () => {
    const res = await POST(createRequest({ date: "2026-03-15", isClosed: false }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("startTime och endTime krävs när dagen inte är stängd")
  })

  it("returns 201 when creating a closed day", async () => {
    const res = await POST(createRequest({
      date: "2026-03-15",
      isClosed: true,
      reason: "Semester",
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.date).toBe("2026-03-15")
    expect(body.isClosed).toBe(true)
    expect(body.reason).toBe("Semester")
  })

  it("returns 201 when creating a day with custom hours", async () => {
    mockUpsert.mockResolvedValue({
      ...mockUpsertResult,
      isClosed: false,
      startTime: "10:00",
      endTime: "14:00",
    } as never)

    const res = await POST(createRequest({
      date: "2026-03-15",
      isClosed: false,
      startTime: "10:00",
      endTime: "14:00",
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.isClosed).toBe(false)
    expect(body.startTime).toBe("10:00")
    expect(body.endTime).toBe("14:00")
  })

  it("returns 201 with location", async () => {
    mockUpsert.mockResolvedValue({
      ...mockUpsertResult,
      location: "Sollebrunn",
    } as never)

    const res = await POST(createRequest({
      date: "2026-03-15",
      isClosed: true,
      location: "Sollebrunn",
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.location).toBe("Sollebrunn")
  })

  it("upserts exception with correct providerId and date", async () => {
    await POST(createRequest({
      date: "2026-03-15",
      isClosed: true,
      reason: "Sjuk",
    }))

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          providerId_date: {
            providerId: "provider-1",
            date: expect.any(Date),
          },
        },
      })
    )
  })

  it("returns 500 on unexpected error", async () => {
    mockUpsert.mockRejectedValue(new Error("DB error"))
    const res = await POST(createRequest({ date: "2026-03-15", isClosed: true }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
