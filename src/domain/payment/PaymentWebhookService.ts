/**
 * PaymentWebhookService - Handles Stripe webhook events for payments
 *
 * Called by the webhook route when payment_intent.succeeded or
 * payment_intent.payment_failed events arrive.
 * Looks up the Payment record by providerPaymentId and updates status.
 */

import { logger } from "@/lib/logger"

export interface PaymentForWebhook {
  id: string
  bookingId: string
  status: string
}

export interface UpdatePaymentData {
  status: string
  paidAt?: Date
  invoiceNumber?: string
  invoiceUrl?: string
}

export interface PaymentWebhookDeps {
  findPaymentByProviderPaymentId: (providerPaymentId: string) => Promise<PaymentForWebhook | null>
  updatePaymentStatus: (paymentId: string, data: UpdatePaymentData) => Promise<void>
  generateInvoiceNumber: () => string
  getBaseUrl: () => string
}

export class PaymentWebhookService {
  constructor(private readonly deps: PaymentWebhookDeps) {}

  async handlePaymentIntentSucceeded(
    paymentIntentId: string,
    metadata: Record<string, string>
  ): Promise<void> {
    const payment = await this.deps.findPaymentByProviderPaymentId(paymentIntentId)

    if (!payment) {
      logger.warn("Payment not found for PaymentIntent", { paymentIntentId })
      return
    }

    if (payment.status === "succeeded") {
      logger.info("Payment already succeeded, skipping", { paymentId: payment.id })
      return
    }

    const invoiceNumber = this.deps.generateInvoiceNumber()
    const bookingId = metadata.bookingId || payment.bookingId
    const invoiceUrl = `${this.deps.getBaseUrl()}/api/bookings/${bookingId}/receipt`

    await this.deps.updatePaymentStatus(payment.id, {
      status: "succeeded",
      paidAt: new Date(),
      invoiceNumber,
      invoiceUrl,
    })

    logger.info("Payment marked as succeeded via webhook", {
      paymentId: payment.id,
      paymentIntentId,
    })
  }

  async handlePaymentIntentFailed(
    paymentIntentId: string,
    _metadata: Record<string, string>
  ): Promise<void> {
    const payment = await this.deps.findPaymentByProviderPaymentId(paymentIntentId)

    if (!payment) {
      logger.warn("Payment not found for failed PaymentIntent", { paymentIntentId })
      return
    }

    // Don't overwrite terminal states
    if (payment.status === "succeeded" || payment.status === "failed") {
      logger.info("Payment already in terminal state, skipping", {
        paymentId: payment.id,
        status: payment.status,
      })
      return
    }

    await this.deps.updatePaymentStatus(payment.id, {
      status: "failed",
    })

    logger.info("Payment marked as failed via webhook", {
      paymentId: payment.id,
      paymentIntentId,
    })
  }
}
