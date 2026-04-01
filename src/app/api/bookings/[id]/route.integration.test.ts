/**
 * Integration tests for PUT/DELETE /api/bookings/[id]
 *
 * BDD outer loop: Route -> real BookingService -> MockedRepos
 * Mocked: auth, prisma, repositories (class mocks), rate-limit, email, notifications, logger
 * NOT mocked: @/domain/booking (BookingService, BookingStatus, mapBookingError*)
 *
 * The real BookingService validates status transitions, authorization,
 * and delegates to the mocked PrismaBookingRepository.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// --- Class mock instances (must be defined before vi.mock) ---

const mockBookingRepo = {
  findById: vi.fn(),
  updateStatusWithAuth: vi.fn(),
  deleteWithAuth: vi.fn(),
  // Stubs for other IBookingRepository methods used by createBookingService deps
  findByProviderAndDateWithLocation: vi.fn(),
  createWithOverlapCheck: vi.fn(),
  findByProviderIdWithDetails: vi.fn(),
  findByCustomerIdWithDetails: vi.fn(),
  findByCustomerId: vi.fn(),
  findByProviderId: vi.fn(),
  findOverlapping: vi.fn(),
  findByStatus: vi.fn(),
  findByProviderAndDate: vi.fn(),
  updateProviderNotesWithAuth: vi.fn(),
  rescheduleWithOverlapCheck: vi.fn(),
  findMany: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
}

const mockProviderRepo = {
  findByUserId: vi.fn(),
}

// --- vi.mock declarations ---

vi.mock("@/infrastructure/persistence/booking/PrismaBookingRepository", () => ({
  PrismaBookingRepository: class MockBookingRepo {
    findById = mockBookingRepo.findById
    updateStatusWithAuth = mockBookingRepo.updateStatusWithAuth
    deleteWithAuth = mockBookingRepo.deleteWithAuth
    findByProviderAndDateWithLocation = mockBookingRepo.findByProviderAndDateWithLocation
    createWithOverlapCheck = mockBookingRepo.createWithOverlapCheck
    findByProviderIdWithDetails = mockBookingRepo.findByProviderIdWithDetails
    findByCustomerIdWithDetails = mockBookingRepo.findByCustomerIdWithDetails
    findByCustomerId = mockBookingRepo.findByCustomerId
    findByProviderId = mockBookingRepo.findByProviderId
    findOverlapping = mockBookingRepo.findOverlapping
    findByStatus = mockBookingRepo.findByStatus
    findByProviderAndDate = mockBookingRepo.findByProviderAndDate
    updateProviderNotesWithAuth = mockBookingRepo.updateProviderNotesWithAuth
    rescheduleWithOverlapCheck = mockBookingRepo.rescheduleWithOverlapCheck
    findMany = mockBookingRepo.findMany
    save = mockBookingRepo.save
    delete = mockBookingRepo.delete
  },
}))

vi.mock("@/infrastructure/persistence/provider/ProviderRepository", () => ({
  ProviderRepository: class MockProviderRepo {
    findByUserId = mockProviderRepo.findByUserId
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    provider: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    booking: { count: vi.fn() },
    availabilityException: { findUnique: vi.fn() },
    routeOrder: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@/lib/email", () => ({
  sendBookingConfirmationNotification: vi.fn(),
  sendBookingStatusChangeNotification: vi.fn(),
  sendPaymentConfirmationNotification: vi.fn(),
}))

vi.mock("@/domain/notification/NotificationService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/notification/NotificationService")>()
  return {
    ...actual,
    notificationService: { createAsync: vi.fn() },
  }
})

vi.mock("@/domain/notification/PushDeliveryService", () => ({
  pushDeliveryService: { sendToUser: vi.fn() },
}))

// DO NOT mock @/domain/booking -- let real BookingService, BookingStatus,
// mapBookingErrorToStatus, mapBookingErrorToMessage run

import { auth } from "@/lib/auth-server"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { rateLimiters } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { PUT, DELETE } from "./route"

// --- Test data ---

const BOOKING_ID = "booking-1"

const mockBookingData = {
  id: BOOKING_ID,
  customerId: "customer-1",
  providerId: "provider-1",
  serviceId: "service-1",
  bookingDate: new Date("2026-05-01"),
  startTime: "10:00",
  endTime: "11:00",
  status: "pending" as const,
  rescheduleCount: 0,
  horseId: undefined,
  horseName: undefined,
  horseInfo: undefined,
  customerNotes: undefined,
  providerNotes: undefined,
  cancellationMessage: undefined,
  timezone: "Europe/Stockholm",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-01"),
  customer: { firstName: "Anna", lastName: "Svensson" },
  service: { name: "Hovslagning", price: 800, durationMinutes: 60 },
  provider: { businessName: "Eriks Hovvård" },
  payment: null,
}

const confirmedBooking = {
  ...mockBookingData,
  status: "confirmed" as const,
}

// --- Helpers ---

function createPutRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/bookings/${BOOKING_ID}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/bookings/${BOOKING_ID}`,
    { method: "DELETE" }
  )
}

// --- PUT tests ---

describe("PUT /api/bookings/[id] (integration)", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: session auth as provider
    vi.mocked(authFromMobileToken).mockResolvedValue(null)
    vi.mocked(auth).mockResolvedValue({
      user: { id: "provider-user-1", email: "erik@example.com", userType: "provider" },
    } as never)

    // Provider lookup
    mockProviderRepo.findByUserId.mockResolvedValue({ id: "provider-1" })

    // BookingService.updateStatus calls findById then updateStatusWithAuth
    mockBookingRepo.findById.mockResolvedValue(mockBookingData)
    mockBookingRepo.updateStatusWithAuth.mockResolvedValue(confirmedBooking)

    // Side effect: provider lookup for event dispatcher
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      userId: "provider-user-1",
    } as never)

    // Rate limiting allowed
    vi.mocked(rateLimiters.booking).mockResolvedValue(true)
  })

  it("provider confirms pending booking -- 200 with updated booking", async () => {
    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe("confirmed")
    expect(body.provider.businessName).toBe("Eriks Hovvård")

    // Real BookingService called findById to validate transition
    expect(mockBookingRepo.findById).toHaveBeenCalledWith(BOOKING_ID)
    // Then delegated to updateStatusWithAuth
    expect(mockBookingRepo.updateStatusWithAuth).toHaveBeenCalledWith(
      BOOKING_ID,
      "confirmed",
      { providerId: "provider-1" },
      undefined
    )
  })

  it("customer cancels booking with message -- 200", async () => {
    // Auth as customer
    vi.mocked(auth).mockResolvedValue({
      user: { id: "customer-1", email: "anna@example.com", userType: "customer" },
    } as never)

    const cancelledBooking = {
      ...mockBookingData,
      status: "cancelled" as const,
      cancellationMessage: "Kan inte komma",
    }
    mockBookingRepo.updateStatusWithAuth.mockResolvedValue(cancelledBooking)

    const res = await PUT(
      createPutRequest({ status: "cancelled", cancellationMessage: "Kan inte komma" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe("cancelled")

    // Customer auth context (customerId = userId for customers)
    expect(mockBookingRepo.updateStatusWithAuth).toHaveBeenCalledWith(
      BOOKING_ID,
      "cancelled",
      { customerId: "customer-1" },
      "Kan inte komma"
    )
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(authFromMobileToken).mockResolvedValue(null)
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/bookings/${BOOKING_ID}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not-json{{{",
      }
    )

    const res = await PUT(req, { params })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 for invalid status value (Zod)", async () => {
    const res = await PUT(
      createPutRequest({ status: "invalid_status" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Valideringsfel")
    expect(body.details).toBeDefined()
  })

  it("returns 400 for extra fields in body (Zod strict)", async () => {
    const res = await PUT(
      createPutRequest({ status: "confirmed", extraField: "should-fail" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.booking).mockResolvedValue(false)

    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain("För många förfrågningar")
  })

  it("returns 400 when customer tries provider-only status (real BookingService validation)", async () => {
    // Auth as customer
    vi.mocked(auth).mockResolvedValue({
      user: { id: "customer-1", email: "anna@example.com", userType: "customer" },
    } as never)

    const res = await PUT(
      createPutRequest({ status: "completed" }),
      { params }
    )
    const body = await res.json()

    // Real BookingService rejects: invalid status transition for customer
    expect(res.status).toBe(400)
    expect(body.error).toContain("Kan inte ändra status")
  })

  it("returns 400 for invalid status transition (real BookingService state machine)", async () => {
    // Booking is pending -- cannot go directly to completed
    const res = await PUT(
      createPutRequest({ status: "completed" }),
      { params }
    )
    const body = await res.json()

    // Real BookingStatus state machine rejects pending -> completed
    expect(res.status).toBe(400)
  })

  it("returns 404 when booking not found (real BookingService)", async () => {
    mockBookingRepo.findById.mockResolvedValue(null)

    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Bokningen hittades inte")
  })

  it("returns 404 when provider not found for provider user", async () => {
    mockProviderRepo.findByUserId.mockResolvedValue(null)

    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("supports mobile token auth (dual auth)", async () => {
    vi.mocked(authFromMobileToken).mockResolvedValue({ userId: "provider-user-1" })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "provider-user-1",
      userType: "provider",
    } as never)

    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )

    expect(res.status).toBe(200)
    // Session auth should NOT have been called since mobile token succeeded
    expect(auth).not.toHaveBeenCalled()
  })

  it("returns 401 when mobile token user not found in DB", async () => {
    vi.mocked(authFromMobileToken).mockResolvedValue({ userId: "nonexistent-user" })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)

    const res = await PUT(
      createPutRequest({ status: "confirmed" }),
      { params }
    )

    expect(res.status).toBe(401)
  })
})

// --- DELETE tests ---

describe("DELETE /api/bookings/[id] (integration)", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: session auth as provider
    vi.mocked(auth).mockResolvedValue({
      user: { id: "provider-user-1", email: "erik@example.com", userType: "provider" },
    } as never)

    // Provider lookup
    mockProviderRepo.findByUserId.mockResolvedValue({ id: "provider-1" })

    // Successful delete
    mockBookingRepo.deleteWithAuth.mockResolvedValue(true)

    // Rate limiting allowed
    vi.mocked(rateLimiters.booking).mockResolvedValue(true)
  })

  it("provider deletes booking -- 200", async () => {
    const res = await DELETE(createDeleteRequest(), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe("Booking deleted")
    expect(mockBookingRepo.deleteWithAuth).toHaveBeenCalledWith(
      BOOKING_ID,
      { providerId: "provider-1" }
    )
  })

  it("customer deletes own booking -- 200", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "customer-1", email: "anna@example.com", userType: "customer" },
    } as never)

    const res = await DELETE(createDeleteRequest(), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockBookingRepo.deleteWithAuth).toHaveBeenCalledWith(
      BOOKING_ID,
      { customerId: "customer-1" }
    )
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await DELETE(createDeleteRequest(), { params })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 404 when booking not found or unauthorized", async () => {
    mockBookingRepo.deleteWithAuth.mockResolvedValue(false)

    const res = await DELETE(createDeleteRequest(), { params })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain("Bokningen hittades inte")
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimiters.booking).mockResolvedValue(false)

    const res = await DELETE(createDeleteRequest(), { params })
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain("För många förfrågningar")
  })

  it("returns 404 when provider not found for provider user", async () => {
    mockProviderRepo.findByUserId.mockResolvedValue(null)

    const res = await DELETE(createDeleteRequest(), { params })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Leverantör hittades inte")
  })
})
