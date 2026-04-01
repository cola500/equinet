/**
 * PaymentGateway - Abstraction for payment processing
 *
 * Defines a common interface for payment providers.
 * Currently only MockPaymentGateway is implemented.
 * When the team decides on Swish/Stripe, add a new class
 * implementing IPaymentGateway - no changes needed in routes or UI.
 */

export interface PaymentRequest {
  bookingId: string
  amount: number
  currency: string
  description: string
}

export interface PaymentResult {
  success: boolean
  providerPaymentId: string
  status: "pending" | "succeeded" | "failed"
  paidAt: Date | null
  error?: string
  clientSecret?: string
}

export interface IPaymentGateway {
  readonly providerName: string
  initiatePayment(request: PaymentRequest): Promise<PaymentResult>
  checkStatus(providerPaymentId: string): Promise<PaymentResult>
}

// --- MockPaymentGateway ---
// Instant success, no external calls. Used for development/demo.

export class MockPaymentGateway implements IPaymentGateway {
  readonly providerName = "mock"

  async initiatePayment(_request: PaymentRequest): Promise<PaymentResult> {
    const providerPaymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    return {
      success: true,
      providerPaymentId,
      status: "succeeded",
      paidAt: new Date(),
    }
  }

  async checkStatus(providerPaymentId: string): Promise<PaymentResult> {
    return {
      success: true,
      providerPaymentId,
      status: "succeeded",
      paidAt: new Date(),
    }
  }
}

/**
 * Factory function to get the appropriate payment gateway.
 * Switches based on PAYMENT_PROVIDER env variable.
 * Default: MockPaymentGateway (instant success, no external calls).
 */
export function getPaymentGateway(): IPaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER

  if (provider === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe")
    }
    // Lazy import to avoid loading Stripe SDK when not needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StripePaymentGateway } = require("./StripePaymentGateway")
    return new StripePaymentGateway(secretKey)
  }

  return new MockPaymentGateway()
}
