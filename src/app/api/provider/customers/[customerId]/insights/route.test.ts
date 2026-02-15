import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    ai: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

const mockFindByUserId = vi.fn()
vi.mock("@/infrastructure/persistence/provider/ProviderRepository", () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

const mockHasCustomerRelationship = vi.fn()
vi.mock("@/lib/customer-relationship", () => ({
  hasCustomerRelationship: (...args: unknown[]) =>
    mockHasCustomerRelationship(...args),
}))

const mockGenerateInsight = vi.fn()
vi.mock("@/domain/customer-insight/CustomerInsightService", () => ({
  CustomerInsightService: class {
    generateInsight = mockGenerateInsight
  },
  mapInsightErrorToStatus: (error: { type: string }) => {
    switch (error.type) {
      case "NO_DATA":
        return 400
      case "API_KEY_MISSING":
        return 503
      case "INTERPRETATION_FAILED":
        return 500
      default:
        return 500
    }
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: vi.fn() },
    providerCustomerNote: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    customerReview: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const mockGetCachedInsight = vi.fn()
const mockSetCachedInsight = vi.fn()
vi.mock("@/lib/cache/customer-insights-cache", () => ({
  getCachedInsight: (...args: unknown[]) => mockGetCachedInsight(...args),
  setCachedInsight: (...args: unknown[]) => mockSetCachedInsight(...args),
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(auth)

function createRequest() {
  return new NextRequest(
    "http://localhost/api/provider/customers/customer-1/insights",
    { method: "POST" }
  )
}

const params = Promise.resolve({ customerId: "customer-1" })

const MOCK_INSIGHT = {
  frequency: "Regelbunden (var 8:e vecka)",
  topServices: ["Hovvård"],
  patterns: ["Bokar på förmiddagen"],
  riskFlags: [],
  vipScore: "medium",
  summary: "Bra kund med regelbundna bokningar.",
  confidence: 0.85,
}

describe("POST /api/provider/customers/[customerId]/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCachedInsight.mockResolvedValue(null)
    mockSetCachedInsight.mockResolvedValue(undefined)
  })

  it("returns 401 without session", async () => {
    mockAuth.mockResolvedValue(null as any)

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(401)
  })

  it("returns 403 for non-provider", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as any)

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(403)
  })

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    vi.mocked(rateLimiters.ai).mockResolvedValueOnce(false)

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(429)
  })

  it("returns 403 when no customer relationship", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(false)

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toContain("kundrelation")
  })

  it("returns 400 when customer has no completed bookings", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(true)

    // Return only cancelled bookings
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        bookingDate: new Date("2026-01-15"),
        startTime: "09:00",
        status: "cancelled",
        providerNotes: null,
        cancellationMessage: "Sjuk",
        service: { name: "Hovvård", price: 1500 },
        horse: null,
      },
    ] as any)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])

    mockGenerateInsight.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "NO_DATA", message: "Kunden har inga genomförda bokningar att analysera" },
    })

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(400)
  })

  it("returns insight on success (happy path)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(true)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        bookingDate: new Date("2026-01-15"),
        startTime: "09:00",
        status: "completed",
        providerNotes: "Allt bra",
        cancellationMessage: null,
        service: { name: "Hovvård", price: 1500 },
        horse: { name: "Stella", breed: "Islandshäst", specialNeeds: null },
      },
      {
        bookingDate: new Date("2025-11-20"),
        startTime: "10:00",
        status: "completed",
        providerNotes: null,
        cancellationMessage: null,
        service: { name: "Hovvård", price: 1500 },
        horse: { name: "Stella", breed: "Islandshäst", specialNeeds: null },
      },
    ] as any)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])

    mockGenerateInsight.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: MOCK_INSIGHT,
    })

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.insight).toBeDefined()
    expect(data.insight.frequency).toBe("Regelbunden (var 8:e vecka)")
    expect(data.insight.vipScore).toBe("medium")
    expect(data.metrics).toBeDefined()
    expect(data.metrics.completedBookings).toBe(2)
    expect(data.metrics.totalSpent).toBe(3000)
  })

  it("returns 500 when AI service fails", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(true)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        bookingDate: new Date("2026-01-15"),
        startTime: "09:00",
        status: "completed",
        providerNotes: null,
        cancellationMessage: null,
        service: { name: "Hovvård", price: 1500 },
        horse: null,
      },
    ] as any)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])

    mockGenerateInsight.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "INTERPRETATION_FAILED", message: "API error" },
    })

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(500)
  })

  it("returns 404 when provider not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue(null)

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(404)
  })

  // --- Cache tests ---

  it("returns cached insight without calling AI", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(true)

    const cachedData = {
      insight: MOCK_INSIGHT,
      metrics: {
        totalBookings: 5,
        completedBookings: 4,
        cancelledBookings: 1,
        totalSpent: 6000,
        avgBookingIntervalDays: 56,
        lastBookingDate: "2026-01-15",
        firstBookingDate: "2025-06-01",
      },
      cachedAt: "2026-02-15T10:00:00.000Z",
    }
    mockGetCachedInsight.mockResolvedValue(cachedData)

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.insight.vipScore).toBe("medium")
    expect(data.cached).toBe(true)
    expect(data.cachedAt).toBe("2026-02-15T10:00:00.000Z")
    // AI should NOT be called
    expect(mockGenerateInsight).not.toHaveBeenCalled()
    // DB queries should NOT be called
    expect(prisma.booking.findMany).not.toHaveBeenCalled()
  })

  it("stores result in cache after AI generation", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(true)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        bookingDate: new Date("2026-01-15"),
        startTime: "09:00",
        status: "completed",
        providerNotes: null,
        cancellationMessage: null,
        service: { name: "Hovvård", price: 1500 },
        horse: null,
      },
    ] as any)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])

    mockGenerateInsight.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: MOCK_INSIGHT,
    })

    const response = await POST(createRequest(), { params })
    expect(response.status).toBe(200)
    expect(mockSetCachedInsight).toHaveBeenCalledWith(
      "provider-1",
      "customer-1",
      expect.objectContaining({
        insight: MOCK_INSIGHT,
      })
    )
  })

  it("ignores cache when ?refresh=true", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider" },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: "provider-1" })
    mockHasCustomerRelationship.mockResolvedValue(true)

    // Cache has data, but we want fresh
    mockGetCachedInsight.mockResolvedValue({
      insight: MOCK_INSIGHT,
      metrics: {},
      cachedAt: "2026-02-15T10:00:00.000Z",
    })

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        bookingDate: new Date("2026-01-15"),
        startTime: "09:00",
        status: "completed",
        providerNotes: null,
        cancellationMessage: null,
        service: { name: "Hovvård", price: 1500 },
        horse: null,
      },
    ] as any)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([])
    vi.mocked(prisma.review.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerReview.findMany).mockResolvedValue([])

    mockGenerateInsight.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: MOCK_INSIGHT,
    })

    const request = new NextRequest(
      "http://localhost/api/provider/customers/customer-1/insights?refresh=true",
      { method: "POST" }
    )
    const response = await POST(request, { params })
    expect(response.status).toBe(200)
    // AI SHOULD be called despite cache hit
    expect(mockGenerateInsight).toHaveBeenCalled()
    // Cache should NOT be checked
    expect(mockGetCachedInsight).not.toHaveBeenCalled()
  })
})
