import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// --- Mocks ---

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

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

vi.mock("@/domain/payment/PaymentGateway", () => ({
  getPaymentGateway: vi.fn(),
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@/lib/notification-helpers", () => ({
  customerName: vi.fn((first: string, last: string) => `${first} ${last}`),
}))

// --- Imports (after mocks) ---

import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { getPaymentGateway } from "@/domain/payment/PaymentGateway"
import {
  createBookingEventDispatcher,
  createBookingPaymentReceivedEvent,
} from "@/domain/booking"
import { logger } from "@/lib/logger"
import { POST, GET } from "./route"

// --- Typed mocks ---

const mockedAuth = vi.mocked(auth)
const mockedFindUnique = vi.mocked(prisma.booking.findUnique)
const mockedFindFirst = vi.mocked(prisma.booking.findFirst)
const mockedPaymentUpsert = vi.mocked(prisma.payment.upsert)
const mockedGetPaymentGateway = vi.mocked(getPaymentGateway)

// --- Helpers ---

function createRequest(bookingId: string, method: "GET" | "POST" = "POST") {
  return new NextRequest(
    `http://localhost:3000/api/bookings/${bookingId}/payment`,
    { method }
  )
}

const BOOKING_ID = "a0000000-0000-4000-a000-000000000001"

const mockBooking = {
  id: BOOKING_ID,
  status: "confirmed",
  providerId: "provider-1",
  customerId: "user-1",
  bookingDate: new Date("2026-03-15T10:00:00Z"),
  service: {
    id: "service-1",
    name: "Hovvard",
    price: 1500,
  },
  payment: null,
  customer: {
    firstName: "Anna",
    lastName: "Andersson",
  },
  provider: {
    userId: "provider-user-1",
    include: {},
    user: {
      firstName: "Erik",
      lastName: "Eriksson",
    },
  },
}

const mockPaymentResult = {
  success: true,
  providerPaymentId: "mock-pay-123",
  status: "succeeded",
  paidAt: new Date("2026-03-15T12:00:00Z"),
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

function mockGateway(result = mockPaymentResult) {
  mockedGetPaymentGateway.mockReturnValue({
    initiatePayment: vi.fn().mockResolvedValue(result),
  } as never)
}

// --- Tests ---

describe("POST /api/bookings/[id]/payment", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "anna@example.com", userType: "customer" },
    } as never)
    mockGateway()
    mockedPaymentUpsert.mockResolvedValue(mockPaymentRecord as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockedAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })

    expect(res.status).toBe(401)
  })

  it("returns 404 when booking not found", async () => {
    mockedFindUnique.mockResolvedValue(null)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Bokning hittades inte")
  })

  it("returns 400 when already paid", async () => {
    mockedFindUnique.mockResolvedValue({
      ...mockBooking,
      payment: { status: "succeeded" },
    } as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Bokningen är redan betald")
  })

  it("returns 400 when booking status is not confirmed or completed", async () => {
    mockedFindUnique.mockResolvedValue({
      ...mockBooking,
      status: "pending",
    } as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe(
      "Bokningen måste vara bekräftad innan betalning kan göras"
    )
  })

  it("returns 200 with payment data on successful payment", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
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

  it("calls payment gateway with correct arguments", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)
    const mockInitiate = vi.fn().mockResolvedValue(mockPaymentResult)
    mockedGetPaymentGateway.mockReturnValue({
      initiatePayment: mockInitiate,
    } as never)

    const req = createRequest(BOOKING_ID, "POST")
    await POST(req, { params })

    expect(mockInitiate).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      amount: 1500,
      currency: "SEK",
      description: "Hovvard",
    })
  })

  it("upserts payment record with correct data", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)

    const req = createRequest(BOOKING_ID, "POST")
    await POST(req, { params })

    expect(mockedPaymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: BOOKING_ID },
        create: expect.objectContaining({
          bookingId: BOOKING_ID,
          amount: 1500,
          currency: "SEK",
          provider: "mock",
          providerPaymentId: "mock-pay-123",
          status: "succeeded",
          paidAt: mockPaymentResult.paidAt,
        }),
        update: expect.objectContaining({
          providerPaymentId: "mock-pay-123",
          status: "succeeded",
          paidAt: mockPaymentResult.paidAt,
        }),
      })
    )
  })

  it("dispatches booking payment received event with correct payload", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)

    const req = createRequest(BOOKING_ID, "POST")
    await POST(req, { params })

    expect(createBookingEventDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        emailService: expect.any(Object),
        notificationService: expect.any(Object),
        logger: expect.any(Object),
      })
    )

    expect(createBookingPaymentReceivedEvent).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      customerId: "user-1",
      providerId: "provider-1",
      providerUserId: "provider-user-1",
      customerName: "Anna Andersson",
      serviceName: "Hovvard",
      bookingDate: mockBooking.bookingDate.toISOString(),
      amount: mockPaymentRecord.amount,
      currency: mockPaymentRecord.currency,
      paymentId: mockPaymentRecord.id,
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      eventType: "PAYMENT_RECEIVED",
      payload: expect.any(Object),
    })
  })

  it("generates invoice number in EQ-YYYYMM-XXXXXX format", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)

    const req = createRequest(BOOKING_ID, "POST")
    await POST(req, { params })

    // Verify the invoiceNumber passed to upsert matches the pattern
    const upsertCall = mockedPaymentUpsert.mock.calls[0][0] as never
    const invoiceNumber = upsertCall.create.invoiceNumber

    expect(invoiceNumber).toMatch(/^EQ-\d{6}-[A-Z0-9]{6}$/)
  })

  it("returns correct response shape", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
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
    mockedFindUnique.mockResolvedValue(mockBooking as never)
    mockedGetPaymentGateway.mockReturnValue({
      initiatePayment: vi
        .fn()
        .mockResolvedValue({ success: false, error: "Insufficient funds" }),
    } as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.error).toBe("Insufficient funds")
  })

  it("returns 402 with default message when gateway fails without error text", async () => {
    mockedFindUnique.mockResolvedValue(mockBooking as never)
    mockedGetPaymentGateway.mockReturnValue({
      initiatePayment: vi.fn().mockResolvedValue({ success: false }),
    } as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
    const body = await res.json()

    expect(res.status).toBe(402)
    expect(body.error).toBe("Betalningen misslyckades")
  })

  it("returns 500 on unexpected error", async () => {
    mockedFindUnique.mockRejectedValue(new Error("Database connection lost"))

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Kunde inte genomföra betalningen")
    expect(logger.error).toHaveBeenCalledWith(
      "Error processing payment",
      expect.any(Error)
    )
  })

  it("allows payment for completed bookings", async () => {
    mockedFindUnique.mockResolvedValue({
      ...mockBooking,
      status: "completed",
    } as never)

    const req = createRequest(BOOKING_ID, "POST")
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
  })
})

describe("GET /api/bookings/[id]/payment", () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "anna@example.com", userType: "customer" },
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockedAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const req = createRequest(BOOKING_ID, "GET")
    const res = await GET(req, { params })

    expect(res.status).toBe(401)
  })

  it("returns 404 when booking not found", async () => {
    mockedFindFirst.mockResolvedValue(null)

    const req = createRequest(BOOKING_ID, "GET")
    const res = await GET(req, { params })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Bokning hittades inte")
  })

  it("returns unpaid status when no payment record exists", async () => {
    mockedFindFirst.mockResolvedValue({
      ...mockBooking,
      payment: null,
    } as never)

    const req = createRequest(BOOKING_ID, "GET")
    const res = await GET(req, { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      status: "unpaid",
      amount: 1500,
      currency: "SEK",
    })
  })

  it("returns full payment data when payment exists", async () => {
    mockedFindFirst.mockResolvedValue({
      ...mockBooking,
      payment: mockPaymentRecord,
    } as never)

    const req = createRequest(BOOKING_ID, "GET")
    const res = await GET(req, { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      id: mockPaymentRecord.id,
      status: mockPaymentRecord.status,
      amount: mockPaymentRecord.amount,
      currency: mockPaymentRecord.currency,
      paidAt: mockPaymentRecord.paidAt.toISOString(),
      invoiceNumber: mockPaymentRecord.invoiceNumber,
      invoiceUrl: mockPaymentRecord.invoiceUrl,
    })
  })

  it("allows provider access via provider.userId", async () => {
    mockedAuth.mockResolvedValue({
      user: {
        id: "provider-user-1",
        email: "erik@example.com",
        userType: "provider",
      },
    } as never)

    mockedFindFirst.mockResolvedValue({
      ...mockBooking,
      payment: mockPaymentRecord,
    } as never)

    const req = createRequest(BOOKING_ID, "GET")
    const res = await GET(req, { params })

    expect(res.status).toBe(200)

    // Verify findFirst was called with OR clause that includes provider.userId
    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: BOOKING_ID,
          OR: [
            { customerId: "provider-user-1" },
            { provider: { userId: "provider-user-1" } },
          ],
        }),
      })
    )
  })

  it("returns 500 on unexpected error", async () => {
    mockedFindFirst.mockRejectedValue(new Error("Database timeout"))

    const req = createRequest(BOOKING_ID, "GET")
    const res = await GET(req, { params })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Kunde inte hämta betalningsstatus")
    expect(logger.error).toHaveBeenCalledWith(
      "Error fetching payment",
      expect.any(Error)
    )
  })
})
