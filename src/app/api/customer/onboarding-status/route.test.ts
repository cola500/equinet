import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { GET } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimiters = vi.mocked(rateLimiters)
const mockFindUnique = vi.mocked(prisma.user.findUnique)

function createRequest() {
  return new NextRequest(
    "http://localhost:3000/api/customer/onboarding-status",
    { method: "GET" }
  )
}

describe("GET /api/customer/onboarding-status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await GET(createRequest())
    expect(response.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockRateLimiters.api.mockResolvedValueOnce(false)

    const response = await GET(createRequest())
    expect(response.status).toBe(429)
  })

  it("should return 404 when user not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue(null)

    const response = await GET(createRequest())
    expect(response.status).toBe(404)
  })

  it("should return all false for empty profile", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: null,
      lastName: null,
      phone: null,
      horses: [],
      bookings: [],
      reviews: [],
    } as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.profileComplete).toBe(false)
    expect(data.hasHorses).toBe(false)
    expect(data.hasBookings).toBe(false)
    expect(data.hasReviews).toBe(false)
    expect(data.allComplete).toBe(false)
  })

  it("should return profileComplete true when name and phone filled", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "Svensson",
      phone: "070-1234567",
      horses: [],
      bookings: [],
      reviews: [],
    } as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.profileComplete).toBe(true)
    expect(data.hasHorses).toBe(false)
    expect(data.allComplete).toBe(false)
  })

  it("should return hasHorses true when at least one horse", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: null,
      lastName: null,
      phone: null,
      horses: [{ id: "horse-1" }],
      bookings: [],
      reviews: [],
    } as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.hasHorses).toBe(true)
  })

  it("should return hasBookings true when at least one booking", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: null,
      lastName: null,
      phone: null,
      horses: [],
      bookings: [{ id: "booking-1" }],
      reviews: [],
    } as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.hasBookings).toBe(true)
  })

  it("should return hasReviews true when at least one review", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: null,
      lastName: null,
      phone: null,
      horses: [],
      bookings: [],
      reviews: [{ id: "review-1" }],
    } as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.hasReviews).toBe(true)
  })

  it("should return allComplete true when all steps done", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "Svensson",
      phone: "070-1234567",
      horses: [{ id: "horse-1" }],
      bookings: [{ id: "booking-1" }],
      reviews: [{ id: "review-1" }],
    } as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.profileComplete).toBe(true)
    expect(data.hasHorses).toBe(true)
    expect(data.hasBookings).toBe(true)
    expect(data.hasReviews).toBe(true)
    expect(data.allComplete).toBe(true)
  })

  it("should use select with minimal fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindUnique.mockResolvedValue({
      firstName: "Anna",
      lastName: "Svensson",
      phone: "070",
      horses: [],
      bookings: [],
      reviews: [],
    } as never)

    await GET(createRequest())

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.objectContaining({
        firstName: true,
        lastName: true,
        phone: true,
      }),
    })
  })
})
