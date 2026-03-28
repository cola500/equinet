import { describe, it, expect, vi } from "vitest"
import { PaymentService } from "./PaymentService"
import type { PaymentServiceDeps, BookingForPayment, BookingForStatus } from "./PaymentService"
import type { IPaymentGateway, PaymentResult } from "./PaymentGateway"

// --- Helpers ---

function mockConfirmedBooking(overrides: Partial<BookingForPayment> = {}): BookingForPayment {
  return {
    id: "booking-1",
    status: "confirmed",
    providerId: "provider-1",
    bookingDate: new Date("2026-03-20"),
    service: { price: 500, name: "Hovvård" },
    payment: null,
    customer: { firstName: "Anna", lastName: "Svensson" },
    provider: { userId: "provider-user-1" },
    ...overrides,
  }
}

function mockBookingForStatus(overrides: Partial<BookingForStatus> = {}): BookingForStatus {
  return {
    payment: {
      id: "pay-1",
      status: "succeeded",
      amount: 500,
      currency: "SEK",
      paidAt: new Date("2026-03-17T10:00:00Z"),
      invoiceNumber: "EQ-202603-ABC123",
      invoiceUrl: "http://localhost:3000/api/bookings/booking-1/receipt",
    },
    service: { price: 500 },
    ...overrides,
  }
}

function successGateway(): IPaymentGateway {
  return {
    initiatePayment: vi.fn().mockResolvedValue({
      success: true,
      providerPaymentId: "mock_pay_123",
      status: "succeeded",
      paidAt: new Date("2026-03-17T10:00:00Z"),
    } satisfies PaymentResult),
    checkStatus: vi.fn(),
  }
}

function failGateway(error?: string): IPaymentGateway {
  return {
    initiatePayment: vi.fn().mockResolvedValue({
      success: false,
      providerPaymentId: "",
      status: "failed",
      paidAt: null,
      error,
    } satisfies PaymentResult),
    checkStatus: vi.fn(),
  }
}

function createDeps(overrides: Partial<PaymentServiceDeps> = {}): PaymentServiceDeps {
  return {
    findBookingForPayment: vi.fn().mockResolvedValue(mockConfirmedBooking()),
    findBookingForStatus: vi.fn().mockResolvedValue(mockBookingForStatus()),
    upsertPayment: vi.fn().mockResolvedValue({
      id: "pay-1",
      bookingId: "booking-1",
      amount: 500,
      currency: "SEK",
      provider: "mock",
      providerPaymentId: "mock_pay_123",
      status: "succeeded",
      paidAt: new Date("2026-03-17T10:00:00Z"),
      invoiceNumber: "EQ-202603-ABC123",
      invoiceUrl: "http://localhost:3000/api/bookings/booking-1/receipt",
    }),
    paymentGateway: successGateway(),
    generateInvoiceNumber: () => "EQ-202603-ABC123",
    getBaseUrl: () => "http://localhost:3000",
    ...overrides,
  }
}

// --- processPayment ---

describe("PaymentService.processPayment", () => {
  it("returns BOOKING_NOT_FOUND when booking does not exist", async () => {
    const deps = createDeps({
      findBookingForPayment: vi.fn().mockResolvedValue(null),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("BOOKING_NOT_FOUND")
  })

  it("returns ALREADY_PAID when payment status is succeeded", async () => {
    const deps = createDeps({
      findBookingForPayment: vi.fn().mockResolvedValue(
        mockConfirmedBooking({ payment: { status: "succeeded" } })
      ),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("ALREADY_PAID")
  })

  it("returns INVALID_STATUS for pending booking", async () => {
    const deps = createDeps({
      findBookingForPayment: vi.fn().mockResolvedValue(
        mockConfirmedBooking({ status: "pending" })
      ),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("INVALID_STATUS")
    if (result.error.type === "INVALID_STATUS") {
      expect(result.error.status).toBe("pending")
    }
  })

  it("returns INVALID_STATUS for cancelled booking", async () => {
    const deps = createDeps({
      findBookingForPayment: vi.fn().mockResolvedValue(
        mockConfirmedBooking({ status: "cancelled" })
      ),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("INVALID_STATUS")
  })

  it("succeeds for confirmed booking", async () => {
    const deps = createDeps()
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isSuccess).toBe(true)
    expect(result.value.payment.id).toBe("pay-1")
  })

  it("succeeds for completed booking", async () => {
    const deps = createDeps({
      findBookingForPayment: vi.fn().mockResolvedValue(
        mockConfirmedBooking({ status: "completed" })
      ),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isSuccess).toBe(true)
  })

  it("returns GATEWAY_FAILED when gateway fails", async () => {
    const deps = createDeps({
      paymentGateway: failGateway("Insufficient funds"),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("GATEWAY_FAILED")
    if (result.error.type === "GATEWAY_FAILED") {
      expect(result.error.message).toBe("Insufficient funds")
    }
  })

  it("returns GATEWAY_FAILED with undefined message when gateway has no error text", async () => {
    const deps = createDeps({
      paymentGateway: failGateway(undefined),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("GATEWAY_FAILED")
  })

  it("calls gateway with correct arguments", async () => {
    const gateway = successGateway()
    const deps = createDeps({ paymentGateway: gateway })
    const service = new PaymentService(deps)

    await service.processPayment("booking-1", "customer-1")

    expect(gateway.initiatePayment).toHaveBeenCalledWith({
      bookingId: "booking-1",
      amount: 500,
      currency: "SEK",
      description: "Hovvård",
    })
  })

  it("calls upsertPayment with invoiceNumber and receiptUrl", async () => {
    const deps = createDeps()
    const service = new PaymentService(deps)

    await service.processPayment("booking-1", "customer-1")

    expect(deps.upsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-1",
        amount: 500,
        currency: "SEK",
        invoiceNumber: "EQ-202603-ABC123",
        invoiceUrl: "http://localhost:3000/api/bookings/booking-1/receipt",
      })
    )
  })

  it("returns eventData with correct payload", async () => {
    const deps = createDeps()
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isSuccess).toBe(true)
    expect(result.value.eventData).toEqual({
      bookingId: "booking-1",
      customerId: "customer-1",
      providerId: "provider-1",
      providerUserId: "provider-user-1",
      customerName: "Anna Svensson",
      serviceName: "Hovvård",
      bookingDate: expect.any(String),
      amount: 500,
      currency: "SEK",
      paymentId: "pay-1",
    })
  })

  it("handles null customer with fallback name", async () => {
    const deps = createDeps({
      findBookingForPayment: vi.fn().mockResolvedValue(
        mockConfirmedBooking({ customer: null as never })
      ),
    })
    const service = new PaymentService(deps)

    const result = await service.processPayment("booking-1", "customer-1")

    expect(result.isSuccess).toBe(true)
    expect(result.value.eventData.customerName).toBe("Kund")
  })
})

// --- getPaymentStatus ---

describe("PaymentService.getPaymentStatus", () => {
  it("returns BOOKING_NOT_FOUND when booking does not exist", async () => {
    const deps = createDeps({
      findBookingForStatus: vi.fn().mockResolvedValue(null),
    })
    const service = new PaymentService(deps)

    const result = await service.getPaymentStatus("booking-1", "user-1")

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe("BOOKING_NOT_FOUND")
  })

  it("returns unpaid with amount/currency when no payment exists", async () => {
    const deps = createDeps({
      findBookingForStatus: vi.fn().mockResolvedValue(
        mockBookingForStatus({ payment: null })
      ),
    })
    const service = new PaymentService(deps)

    const result = await service.getPaymentStatus("booking-1", "user-1")

    expect(result.isSuccess).toBe(true)
    expect(result.value).toEqual({
      status: "unpaid",
      amount: 500,
      currency: "SEK",
    })
  })

  it("returns full payment data when payment exists", async () => {
    const deps = createDeps()
    const service = new PaymentService(deps)

    const result = await service.getPaymentStatus("booking-1", "user-1")

    expect(result.isSuccess).toBe(true)
    expect(result.value).toEqual({
      id: "pay-1",
      status: "succeeded",
      amount: 500,
      currency: "SEK",
      paidAt: expect.any(Date),
      invoiceNumber: "EQ-202603-ABC123",
      invoiceUrl: "http://localhost:3000/api/bookings/booking-1/receipt",
    })
  })
})
