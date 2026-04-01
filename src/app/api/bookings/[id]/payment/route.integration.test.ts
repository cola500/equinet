/**
 * Integration tests for POST /api/bookings/[id]/payment
 *
 * BDD outer loop: Route -> PaymentService -> MockPaymentGateway
 * Only Prisma and auth are mocked. PaymentService runs real logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// --- Mock Prisma ---

const mockBooking = {
  id: "booking-1",
  status: "confirmed",
  providerId: "provider-1",
  bookingDate: new Date("2026-05-01"),
  service: { price: 1200, name: "Hovslagning" },
  payment: null,
  customer: { firstName: "Anna", lastName: "Svensson" },
  provider: { userId: "provider-user-1" },
}

const mockPaymentRecord = {
  id: "payment-1",
  bookingId: "booking-1",
  amount: 1200,
  currency: "SEK",
  provider: "mock",
  providerPaymentId: expect.stringMatching(/^mock_pay_/),
  status: "succeeded",
  paidAt: expect.any(Date),
  invoiceNumber: expect.stringMatching(/^EQ-/),
  invoiceUrl: expect.stringContaining("/api/bookings/booking-1/receipt"),
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    payment: {
      upsert: vi.fn(),
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

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// DO NOT mock @/domain/payment -- let real PaymentService + MockPaymentGateway run

import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { POST } from "./route"

const BOOKING_ID = "booking-1"

function createRequest(bookingId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/bookings/${bookingId}/payment`,
    { method: "POST" }
  )
}

describe("POST /api/bookings/[id]/payment (integration)", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: "customer-1", email: "anna@example.com", userType: "customer" },
    } as never)

    // Prisma mocks -- these simulate the DB layer
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as never)
    vi.mocked(prisma.payment.upsert).mockImplementation(async (args) => {
      const data = (args as never as { create: Record<string, unknown> }).create
      return {
        id: "payment-1",
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never
    })
  })

  it("processes payment through real PaymentService + MockPaymentGateway", async () => {
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe("Betalning genomförd")
    expect(body.payment.status).toBe("succeeded")
    expect(body.payment.amount).toBe(1200)
    expect(body.payment.currency).toBe("SEK")
    expect(body.payment.invoiceNumber).toMatch(/^EQ-/)
  })

  it("stores payment with correct provider via gateway", async () => {
    await POST(createRequest(BOOKING_ID), { params })

    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          bookingId: BOOKING_ID,
          amount: 1200,
          currency: "SEK",
          provider: "mock",
          status: "succeeded",
          invoiceNumber: expect.stringMatching(/^EQ-/),
        }),
      })
    )
  })

  it("returns 404 when booking not found", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null as never)

    const res = await POST(createRequest(BOOKING_ID), { params })
    expect(res.status).toBe(404)
  })

  it("returns 400 when booking already paid", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      payment: { status: "succeeded" },
    } as never)

    const res = await POST(createRequest(BOOKING_ID), { params })
    expect(res.status).toBe(400)
  })

  it("returns 400 when booking status is pending", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      status: "pending",
    } as never)

    const res = await POST(createRequest(BOOKING_ID), { params })
    expect(res.status).toBe(400)
  })
})
