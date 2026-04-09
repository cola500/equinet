/**
 * PATCH /api/native/announcements/[id]/bookings/[bookingId]
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({ getAuthUser: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeOrder: { findFirst: vi.fn() },
    booking: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))

import { PATCH } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(getAuthUser)
const PROVIDER_ID = "b0000000-0000-4000-a000-000000000001"

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/native/announcements/ann-1/bookings/book-1", {
    method: "PATCH",
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: "ann-1", bookingId: "book-1" })

describe("PATCH /api/native/announcements/[id]/bookings/[bookingId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      id: "user-1", email: "t@t.com", providerId: PROVIDER_ID,
      customerId: null, stableId: null, isAdmin: false, authMethod: "supabase",
    })
    vi.mocked(prisma.routeOrder.findFirst).mockResolvedValue({ id: "ann-1" } as never)
    vi.mocked(prisma.booking.findFirst).mockResolvedValue({ id: "book-1" } as never)
    vi.mocked(prisma.booking.update).mockResolvedValue({ id: "book-1", status: "confirmed" } as never)
  })

  it("returns 200 on confirm", async () => {
    const res = await PATCH(createRequest({ status: "confirmed" }), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe("confirmed")
  })

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(createRequest({ status: "confirmed" }), { params })
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid status", async () => {
    const res = await PATCH(createRequest({ status: "invalid" }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 404 for non-owned announcement", async () => {
    vi.mocked(prisma.routeOrder.findFirst).mockResolvedValue(null as never)
    const res = await PATCH(createRequest({ status: "confirmed" }), { params })
    expect(res.status).toBe(404)
  })

  it("returns 404 for non-pending booking", async () => {
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(null as never)
    const res = await PATCH(createRequest({ status: "cancelled" }), { params })
    expect(res.status).toBe(404)
  })
})
