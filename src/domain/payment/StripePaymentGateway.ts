/**
 * StripePaymentGateway - Stripe implementation of IPaymentGateway
 *
 * Creates PaymentIntents with card payment method.
 * Swish can be enabled later by adding 'swish' to payment_method_types
 * when the Stripe account has Swish activated.
 *
 * Amount conversion: Stripe uses smallest currency unit (öre for SEK).
 * 1200 SEK -> 120000 öre.
 */

import Stripe from "stripe"
import type { IPaymentGateway, PaymentRequest, PaymentResult } from "./PaymentGateway"

export class StripePaymentGateway implements IPaymentGateway {
  private stripe: Stripe
  readonly providerName = "stripe"

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey)
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toLowerCase(),
        payment_method_types: ["card"],
        metadata: { bookingId: request.bookingId },
        description: request.description,
      })

      return {
        success: true,
        providerPaymentId: paymentIntent.id,
        status: this.mapStatus(paymentIntent.status),
        paidAt: paymentIntent.status === "succeeded" ? new Date() : null,
        clientSecret: paymentIntent.client_secret ?? undefined,
      }
    } catch (err) {
      return {
        success: false,
        providerPaymentId: "",
        status: "failed",
        paidAt: null,
        error: err instanceof Error ? err.message : "Unknown Stripe error",
      }
    }
  }

  async checkStatus(providerPaymentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(providerPaymentId)

      const status = this.mapStatus(paymentIntent.status)
      return {
        success: status !== "failed",
        providerPaymentId: paymentIntent.id,
        status,
        paidAt: status === "succeeded" ? new Date() : null,
      }
    } catch (err) {
      return {
        success: false,
        providerPaymentId,
        status: "failed",
        paidAt: null,
        error: err instanceof Error ? err.message : "Unknown Stripe error",
      }
    }
  }

  private mapStatus(stripeStatus: string): "pending" | "succeeded" | "failed" {
    switch (stripeStatus) {
      case "succeeded":
        return "succeeded"
      case "requires_payment_method":
      case "requires_confirmation":
      case "requires_action":
      case "processing":
        return "pending"
      case "canceled":
      case "requires_capture":
      default:
        return "failed"
    }
  }
}
