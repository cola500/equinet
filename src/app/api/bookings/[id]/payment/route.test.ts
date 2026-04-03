import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared/types/Result"

// --- Mocks ---

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

const mockProcessPayment = vi.fn()
const mockGetPaymentStatus = vi.fn()

vi.mock("@/domain/payment", () => ({
  createPaymentService: () => ({
    processPayment: mockProcessPayment,
    getPaymentStatus: mockGetPaymentStatus,
  }),
  mapPaymentErrorToStatus: vi.fn((error: { type: string }) => {
    const map: Record<string, number> = {
      BOOKING_NOT_FOUND: 404,
      ALREADY_PAID: 400,
      INVALID_STATUS: 400,
      GATEWAY_FAILED: 402,
    }
    return map[error.type] ?? 500
  }),
  mapPaymentErrorToMessage: vi.fn((error: { type: string; message?: string }) => {
    const map: Record<string, string> = {
      BOOKING_NOT_FOUND: "Bokning hittades inte",
      ALREADY_PAID: "Bokningen är redan betald",
      INVALID_STATUS: "Bokningen måste vara bekräftad innan betalning kan göras",
    }
    if (error.type === "GATEWAY_FAILED") return error.message || "Betalningen misslyckades"
    return map[error.type] ?? "Ett fel uppstod vid betalning"
  }),
}))

const mockDispatch = vi.fn().mockResolvedValue(undefined)

vi.mock("@/domain/booking", () => ({
  createBookingEventDispatcher: vi.fn(() => ({ dispatch: mockDispatch })),
  createBookingPaymentReceivedEvent: vi.fn((payload) => ({
    eventType: "PAYMENT_RECEIVED",
    payload,
  })),
}))

vi.mock("@/lib/email", () => ({
  sendBookingConfirmationNotification: vi.fn(),
  sendBookingStatusChangeNotification: vi.fn(),
  sendPaymentConfirmationNotification: vi.fn(),
}))

vi.mock("@/domain/notification/NotificationService", () => ({
  notificationService: { createAsync: vi.fn() },
}))

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

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

// --- Imports ---

import { getAuthUser } from "@/lib/auth-dual"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import {
  createBookingPaymentReceivedEvent,
} from "@/domain/booking"
import { POST, GET } from "./route"

// --- Helpers ---

const BOOKING_ID = "a0000000-0000-4000-a000-000000000001"

function createRequest(bookingId: string, method: "GET" | "POST" = "POST") {
  return new NextRequest(
    `http://localhost:3000/api/bookings/${bookingId}/payment`,
    { method },
  )
}

const mockPaymentRecord = {
  id: "payment-1",
  bookingId: BOOKING_ID,
  amount: 1500,
  currency: "SEK",
  provider: "mock",
  providerPaymentId: "mock-pay-123",
  status: "succeeded",
  paidAt: new Date("2026-03-15T12:00:00Z"),
  invoiceNumber: "EQ-202603-ABC123",
  invoiceUrl: `http://localhost:3000/api/bookings/${BOOKING_ID}/receipt`,
}

const mockEventData = {
  bookingId: BOOKING_ID,
  customerId: "user-1",
  providerId: "provider-1",
  providerUserId: "provider-user-1",
  customerName: "Anna Andersson",
  serviceName: "Hovvard",
  bookingDate: "2026-03-15T10:00:00.000Z",
  amount: 1500,
  currency: "SEK",
  paymentId: "payment-1",
}

// --- Tests ---

describe("POST /api/bookings/[id]/payment", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1", email: "anna@example.com", userType: "customer", isAdmin: false, providerId: null, stableId: null, authMethod: "nextauth" as const,
    })
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockProcessPayment.mockResolvedValue(
      Result.ok({ payment: mockPaymentRecord, eventData: mockEventData }),
    )
  })

  it("returns 404 when stripe_payments flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe("Ej tillgänglig")
    expect(isFeatureEnabled).toHaveBeenCalledWith("stripe_payments")
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(createRequest(BOOKING_ID), { params })
    expect(res.status).toBe(401)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(createRequest(BOOKING_ID), { params })
    expect(res.status).toBe(401)
  })

  it("returns 404 when booking not found", async () => {
    mockProcessPayment.mockResolvedValue(
      Result.fail({ type: "BOOKING_NOT_FOUND" }),
    )
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe("Bokning hittades inte")
  })

  it("returns 400 when already paid", async () => {
    mockProcessPayment.mockResolvedValue(
      Result.fail({ type: "ALREADY_PAID" }),
    )
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("Bokningen är redan betald")
  })

  it("returns 400 when booking status is not confirmed or completed", async () => {
    mockProcessPayment.mockResolvedValue(
      Result.fail({ type: "INVALID_STATUS", status: "pending" }),
    )
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("Bokningen måste vara bekräftad innan betalning kan göras")
  })

  it("returns 200 with payment data on successful payment", async () => {
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.message).toBe("Betalning genomförd")
    expect(body.payment).toEqual({
      id: mockPaymentRecord.id,
      amount: mockPaymentRecord.amount,
      currency: mockPaymentRecord.currency,
      status: mockPaymentRecord.status,
      paidAt: mockPaymentRecord.paidAt.toISOString(),
      invoiceNumber: mockPaymentRecord.invoiceNumber,
    })
  })

  it("dispatches booking payment received event", async () => {
    await POST(createRequest(BOOKING_ID), { params })

    expect(createBookingPaymentReceivedEvent).toHaveBeenCalledWith(mockEventData)
    expect(mockDispatch).toHaveBeenCalledWith({
      eventType: "PAYMENT_RECEIVED",
      payload: mockEventData,
    })
  })

  it("returns correct response shape", async () => {
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()

    expect(body).toHaveProperty("success")
    expect(body).toHaveProperty("message")
    expect(body).toHaveProperty("payment")
    expect(body.payment).toHaveProperty("id")
    expect(body.payment).toHaveProperty("amount")
    expect(body.payment).toHaveProperty("currency")
    expect(body.payment).toHaveProperty("status")
    expect(body.payment).toHaveProperty("paidAt")
    expect(body.payment).toHaveProperty("invoiceNumber")
  })

  it("returns 402 when payment gateway fails", async () => {
    mockProcessPayment.mockResolvedValue(
      Result.fail({ type: "GATEWAY_FAILED", message: "Insufficient funds" }),
    )
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.error).toBe("Insufficient funds")
  })

  it("returns 402 with default message when gateway fails without error text", async () => {
    mockProcessPayment.mockResolvedValue(
      Result.fail({ type: "GATEWAY_FAILED" }),
    )
    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.error).toBe("Betalningen misslyckades")
  })

  it("returns 500 on unexpected error", async () => {
    mockProcessPayment.mockRejectedValue(new Error("Database connection lost"))

    const res = await POST(createRequest(BOOKING_ID), { params })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Kunde inte genomföra betalningen")
    expect(logger.error).toHaveBeenCalledWith(
      "Error processing payment",
      expect.any(Error),
    )
  })
})

describe("GET /api/bookings/[id]/payment", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1", email: "anna@example.com", userType: "customer", isAdmin: false, providerId: null, stableId: null, authMethod: "nextauth" as const,
    })
  })

  it("returns 401 when session is null", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(createRequest(BOOKING_ID, "GET"), { params })
    expect(res.status).toBe(401)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(createRequest(BOOKING_ID, "GET"), { params })
    expect(res.status).toBe(401)
  })

  it("returns 404 when booking not found", async () => {
    mockGetPaymentStatus.mockResolvedValue(
      Result.fail({ type: "BOOKING_NOT_FOUND" }),
    )
    const res = await GET(createRequest(BOOKING_ID, "GET"), { params })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Bokning hittades inte")
  })

  it("returns unpaid status when no payment record exists", async () => {
    mockGetPaymentStatus.mockResolvedValue(
      Result.ok({ status: "unpaid", amount: 1500, currency: "SEK" }),
    )
    const res = await GET(createRequest(BOOKING_ID, "GET"), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "unpaid", amount: 1500, currency: "SEK" })
  })

  it("returns full payment data when payment exists", async () => {
    mockGetPaymentStatus.mockResolvedValue(
      Result.ok({
        id: "payment-1",
        status: "succeeded",
        amount: 1500,
        currency: "SEK",
        paidAt: new Date("2026-03-15T12:00:00Z"),
        invoiceNumber: "EQ-202603-ABC123",
        invoiceUrl: `http://localhost:3000/api/bookings/${BOOKING_ID}/receipt`,
      }),
    )
    const res = await GET(createRequest(BOOKING_ID, "GET"), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe("payment-1")
    expect(body.status).toBe("succeeded")
    expect(body.amount).toBe(1500)
    expect(body.invoiceNumber).toBe("EQ-202603-ABC123")
  })

  it("returns 500 on unexpected error", async () => {
    mockGetPaymentStatus.mockRejectedValue(new Error("Database timeout"))

    const res = await GET(createRequest(BOOKING_ID, "GET"), { params })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Kunde inte hämta betalningsstatus")
    expect(logger.error).toHaveBeenCalledWith(
      "Error fetching payment",
      expect.any(Error),
    )
  })
})
