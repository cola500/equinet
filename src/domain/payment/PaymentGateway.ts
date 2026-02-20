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
}

export interface IPaymentGateway {
  initiatePayment(request: PaymentRequest): Promise<PaymentResult>
  checkStatus(providerPaymentId: string): Promise<PaymentResult>
}

// --- MockPaymentGateway ---
// Instant success, no external calls. Used for development/demo.

export class MockPaymentGateway implements IPaymentGateway {
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
 * Currently always returns MockPaymentGateway.
 * When adding a real provider, switch based on env variable:
 *   PAYMENT_PROVIDER=swish -> new SwishPaymentGateway()
 *   PAYMENT_PROVIDER=stripe -> new StripePaymentGateway()
 */
export function getPaymentGateway(): IPaymentGateway {
  return new MockPaymentGateway()
}
