/**
 * PaymentService - Domain service for payment processing
 *
 * Encapsulates payment business logic:
 * - Booking status validation
 * - Payment gateway interaction
 * - Invoice generation
 * - Event data preparation (dispatch stays in route)
 */
import { Result } from "@/domain/shared/types/Result"
import type { IPaymentGateway } from "./PaymentGateway"
import type { BookingPaymentReceivedPayload } from "@/domain/booking/BookingEvents"

// --- Types ---

export type PaymentError =
  | { type: "BOOKING_NOT_FOUND" }
  | { type: "ALREADY_PAID" }
  | { type: "INVALID_STATUS"; status: string }
  | { type: "GATEWAY_FAILED"; message?: string }

export interface BookingForPayment {
  id: string
  status: string
  providerId: string
  bookingDate: Date
  service: { price: number; name: string }
  payment: { status: string } | null
  customer: { firstName: string; lastName: string } | null
  provider: { userId: string }
}

export interface BookingForStatus {
  payment: {
    id: string
    status: string
    amount: number
    currency: string
    paidAt: Date | null
    invoiceNumber: string | null
    invoiceUrl: string | null
  } | null
  service: { price: number }
}

export interface PaymentRecord {
  id: string
  bookingId: string
  amount: number
  currency: string
  provider: string
  providerPaymentId: string | null
  status: string
  paidAt: Date | null
  invoiceNumber: string | null
  invoiceUrl: string | null
}

export interface UpsertPaymentData {
  bookingId: string
  amount: number
  currency: string
  provider: string
  providerPaymentId: string
  status: string
  paidAt: Date | null
  invoiceNumber: string
  invoiceUrl: string
}

export interface ProcessPaymentResult {
  payment: PaymentRecord
  eventData: BookingPaymentReceivedPayload
}

export type PaymentStatusResponse =
  | { status: "unpaid"; amount: number; currency: string }
  | {
      id: string
      status: string
      amount: number
      currency: string
      paidAt: Date | null
      invoiceNumber: string | null
      invoiceUrl: string | null
    }

export interface PaymentServiceDeps {
  findBookingForPayment: (bookingId: string, customerId: string) => Promise<BookingForPayment | null>
  findBookingForStatus: (bookingId: string, userId: string) => Promise<BookingForStatus | null>
  upsertPayment: (data: UpsertPaymentData) => Promise<PaymentRecord>
  paymentGateway: IPaymentGateway
  generateInvoiceNumber: () => string
  getBaseUrl: () => string
}

// --- Factory ---

export { createPaymentService } from "./createPaymentService"

// --- Service ---

export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  async processPayment(
    bookingId: string,
    customerId: string
  ): Promise<Result<ProcessPaymentResult, PaymentError>> {
    const booking = await this.deps.findBookingForPayment(bookingId, customerId)

    if (!booking) {
      return Result.fail({ type: "BOOKING_NOT_FOUND" })
    }

    if (booking.payment?.status === "succeeded") {
      return Result.fail({ type: "ALREADY_PAID" })
    }

    if (!["confirmed", "completed"].includes(booking.status)) {
      return Result.fail({ type: "INVALID_STATUS", status: booking.status })
    }

    const paymentResult = await this.deps.paymentGateway.initiatePayment({
      bookingId: booking.id,
      amount: booking.service.price,
      currency: "SEK",
      description: booking.service.name,
    })

    if (!paymentResult.success) {
      return Result.fail({ type: "GATEWAY_FAILED", message: paymentResult.error })
    }

    const receiptUrl = `${this.deps.getBaseUrl()}/api/bookings/${booking.id}/receipt`
    const invoiceNumber = this.deps.generateInvoiceNumber()

    const payment = await this.deps.upsertPayment({
      bookingId: booking.id,
      amount: booking.service.price,
      currency: "SEK",
      provider: "mock",
      providerPaymentId: paymentResult.providerPaymentId,
      status: paymentResult.status,
      paidAt: paymentResult.paidAt,
      invoiceNumber,
      invoiceUrl: receiptUrl,
    })

    const customerName = booking.customer
      ? `${booking.customer.firstName} ${booking.customer.lastName}`
      : "Kund"

    const eventData: BookingPaymentReceivedPayload = {
      bookingId: booking.id,
      customerId,
      providerId: booking.providerId,
      providerUserId: booking.provider.userId,
      customerName,
      serviceName: booking.service.name,
      bookingDate: booking.bookingDate instanceof Date
        ? booking.bookingDate.toISOString()
        : String(booking.bookingDate),
      amount: payment.amount,
      currency: payment.currency,
      paymentId: payment.id,
    }

    return Result.ok({ payment, eventData })
  }

  async getPaymentStatus(
    bookingId: string,
    userId: string
  ): Promise<Result<PaymentStatusResponse, PaymentError>> {
    const booking = await this.deps.findBookingForStatus(bookingId, userId)

    if (!booking) {
      return Result.fail({ type: "BOOKING_NOT_FOUND" })
    }

    if (!booking.payment) {
      return Result.ok({
        status: "unpaid",
        amount: booking.service.price,
        currency: "SEK",
      })
    }

    return Result.ok({
      id: booking.payment.id,
      status: booking.payment.status,
      amount: booking.payment.amount,
      currency: booking.payment.currency,
      paidAt: booking.payment.paidAt,
      invoiceNumber: booking.payment.invoiceNumber,
      invoiceUrl: booking.payment.invoiceUrl,
    })
  }
}
