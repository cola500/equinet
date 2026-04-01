/**
 * Integration tests for POST /api/reviews
 *
 * BDD outer loop: Route -> ReviewService -> MockReviewRepository
 * Real ReviewService runs. Only boundaries are mocked:
 * - auth (session)
 * - rate limiting
 * - Prisma (inline getBooking/getProviderUserId queries)
 * - ReviewRepository (class mock)
 * - NotificationService (side effect)
 * - logger
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import type { Review } from "@/infrastructure/persistence/review/IReviewRepository"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CUSTOMER_ID = "customer-1"
const PROVIDER_ID = "provider-1"
const BOOKING_ID = "booking-1"

const mockBookingData = {
  id: BOOKING_ID,
  customerId: CUSTOMER_ID,
  providerId: PROVIDER_ID,
  status: "completed",
  review: null,
  customer: { firstName: "Anna", lastName: "Svensson" },
  service: { name: "Hovslagning" },
}

const mockCreatedReview: Review = {
  id: "review-1",
  rating: 5,
  comment: "Fantastiskt jobb!",
  bookingId: BOOKING_ID,
  customerId: CUSTOMER_ID,
  providerId: PROVIDER_ID,
  reply: null,
  repliedAt: null,
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-01"),
}

// ---------------------------------------------------------------------------
// Mocks -- only boundaries, NOT ReviewService or mapReviewErrorToStatus
// ---------------------------------------------------------------------------

const mockReviewRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByBookingId: vi.fn(),
  findByProviderId: vi.fn(),
  findByCustomerId: vi.fn(),
  findByIdForCustomer: vi.fn(),
  updateWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
  addReplyWithAuth: vi.fn(),
  deleteReplyWithAuth: vi.fn(),
}

vi.mock("@/infrastructure/persistence/review/ReviewRepository", () => ({
  ReviewRepository: class MockReviewRepository {
    create = mockReviewRepo.create
    findById = mockReviewRepo.findById
    findByBookingId = mockReviewRepo.findByBookingId
    findByProviderId = mockReviewRepo.findByProviderId
    findByCustomerId = mockReviewRepo.findByCustomerId
    findByIdForCustomer = mockReviewRepo.findByIdForCustomer
    updateWithAuth = mockReviewRepo.updateWithAuth
    deleteWithAuth = mockReviewRepo.deleteWithAuth
    addReplyWithAuth = mockReviewRepo.addReplyWithAuth
    deleteReplyWithAuth = mockReviewRepo.deleteReplyWithAuth
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/domain/notification/NotificationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/notification/NotificationService")>()
  return {
    ...actual,
    notificationService: { createAsync: vi.fn() },
  }
})

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { POST } from "./route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  bookingId: BOOKING_ID,
  rating: 5,
  comment: "Fantastiskt jobb!",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/reviews (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Auth: customer session
    vi.mocked(auth).mockResolvedValue({
      user: { id: CUSTOMER_ID, email: "anna@test.se", userType: "customer" },
    } as never)

    // Prisma: booking lookup (used by getBooking in route)
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBookingData as never)

    // Prisma: provider user lookup (used by getProviderUserId in route)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      userId: "provider-user-1",
    } as never)

    // ReviewRepository: create returns the review
    mockReviewRepo.create.mockResolvedValue(mockCreatedReview)
  })

  it("creates review for completed booking -- 201", async () => {
    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toMatchObject({
      id: "review-1",
      rating: 5,
      comment: "Fantastiskt jobb!",
      bookingId: BOOKING_ID,
      customerId: CUSTOMER_ID,
      providerId: PROVIDER_ID,
    })
  })

  it("creates review without comment -- 201", async () => {
    const reviewWithoutComment = { ...mockCreatedReview, rating: 4, comment: null }
    mockReviewRepo.create.mockResolvedValue(reviewWithoutComment)

    const res = await POST(makeRequest({ bookingId: BOOKING_ID, rating: 4 }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.rating).toBe(4)
    expect(body.comment).toBeNull()
  })

  it("passes correct data to ReviewRepository.create", async () => {
    await POST(makeRequest(validBody))

    expect(mockReviewRepo.create).toHaveBeenCalledWith({
      rating: 5,
      comment: "Fantastiskt jobb!",
      bookingId: BOOKING_ID,
      customerId: CUSTOMER_ID,
      providerId: PROVIDER_ID,
    })
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not customer", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "provider-1", email: "prov@test.se", userType: "provider" },
    } as never)

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("returns 400 for missing bookingId", async () => {
    const res = await POST(makeRequest({ rating: 5 }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 for rating below 1", async () => {
    const res = await POST(makeRequest({ bookingId: BOOKING_ID, rating: 0 }))

    expect(res.status).toBe(400)
  })

  it("returns 400 for rating above 5", async () => {
    const res = await POST(makeRequest({ bookingId: BOOKING_ID, rating: 6 }))

    expect(res.status).toBe(400)
  })

  it("returns 400 for non-integer rating", async () => {
    const res = await POST(makeRequest({ bookingId: BOOKING_ID, rating: 3.5 }))

    expect(res.status).toBe(400)
  })

  it("returns 400 for unknown fields (strict schema)", async () => {
    const res = await POST(makeRequest({ ...validBody, sneaky: "extra" }))

    expect(res.status).toBe(400)
  })

  it("returns 404 when booking not found", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null as never)

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Booking not found")
  })

  it("returns 403 when booking belongs to different customer", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBookingData,
      customerId: "other-customer",
    } as never)

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Not authorized")
  })

  it("returns 400 when booking is not completed", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBookingData,
      status: "confirmed",
    } as never)

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Only completed bookings can be reviewed")
  })

  it("returns 409 when booking already has a review", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBookingData,
      review: { id: "existing-review" },
    } as never)

    const res = await POST(makeRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe("Review already exists for this booking")
  })
})
