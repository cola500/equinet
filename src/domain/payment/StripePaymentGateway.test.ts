import { describe, it, expect, vi, beforeEach } from "vitest"
import type { PaymentRequest } from "./PaymentGateway"

// Mock stripe module before importing the gateway
vi.mock("stripe", () => {
  class MockStripe {
    paymentIntents = {
      create: vi.fn(),
      retrieve: vi.fn(),
    }
  }
  return { default: MockStripe }
})

import { StripePaymentGateway } from "./StripePaymentGateway"
import Stripe from "stripe"

describe("StripePaymentGateway", () => {
  let gateway: StripePaymentGateway
  let mockStripe: { paymentIntents: { create: ReturnType<typeof vi.fn>; retrieve: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = new StripePaymentGateway("sk_test_fake_key")
    // Access the mocked stripe instance
    mockStripe = (gateway as never as { stripe: typeof mockStripe }).stripe
  })

  describe("initiatePayment", () => {
    const request: PaymentRequest = {
      bookingId: "booking-1",
      amount: 1200,
      currency: "SEK",
      description: "Hovslagning",
    }

    it("creates a PaymentIntent with correct parameters", async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_test_123",
        status: "requires_payment_method",
        client_secret: "pi_test_123_secret",
      })

      await gateway.initiatePayment(request)

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 120000, // 1200 SEK * 100 = 120000 ore
        currency: "sek",
        payment_method_types: ["card"],
        metadata: { bookingId: "booking-1" },
        description: "Hovslagning",
      })
    })

    it("returns pending status with client_secret for async payment", async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_test_456",
        status: "requires_payment_method",
        client_secret: "pi_test_456_secret_abc",
      })

      const result = await gateway.initiatePayment(request)

      expect(result).toEqual({
        success: true,
        providerPaymentId: "pi_test_456",
        status: "pending",
        paidAt: null,
        clientSecret: "pi_test_456_secret_abc",
      })
    })

    it("returns succeeded when PaymentIntent is already succeeded", async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: "pi_test_instant",
        status: "succeeded",
        client_secret: "pi_test_instant_secret",
      })

      const result = await gateway.initiatePayment(request)

      expect(result.success).toBe(true)
      expect(result.status).toBe("succeeded")
      expect(result.paidAt).toBeInstanceOf(Date)
    })

    it("returns failed on Stripe API error", async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error("Your card was declined.")
      )

      const result = await gateway.initiatePayment(request)

      expect(result).toEqual({
        success: false,
        providerPaymentId: "",
        status: "failed",
        paidAt: null,
        error: "Your card was declined.",
      })
    })
  })

  describe("checkStatus", () => {
    it("maps succeeded PaymentIntent correctly", async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_123",
        status: "succeeded",
      })

      const result = await gateway.checkStatus("pi_test_123")

      expect(result).toEqual({
        success: true,
        providerPaymentId: "pi_test_123",
        status: "succeeded",
        paidAt: expect.any(Date),
      })
    })

    it("maps requires_payment_method to pending", async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_pending",
        status: "requires_payment_method",
      })

      const result = await gateway.checkStatus("pi_test_pending")

      expect(result.status).toBe("pending")
      expect(result.paidAt).toBeNull()
    })

    it("maps requires_action to pending", async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_action",
        status: "requires_action",
      })

      const result = await gateway.checkStatus("pi_test_action")

      expect(result.status).toBe("pending")
    })

    it("maps canceled to failed", async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: "pi_test_cancel",
        status: "canceled",
      })

      const result = await gateway.checkStatus("pi_test_cancel")

      expect(result).toEqual({
        success: false,
        providerPaymentId: "pi_test_cancel",
        status: "failed",
        paidAt: null,
      })
    })

    it("returns failed on Stripe API error", async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(
        new Error("No such payment_intent: pi_invalid")
      )

      const result = await gateway.checkStatus("pi_invalid")

      expect(result.success).toBe(false)
      expect(result.status).toBe("failed")
      expect(result.error).toBe("No such payment_intent: pi_invalid")
    })
  })

  describe("providerName", () => {
    it("returns stripe", () => {
      expect(gateway.providerName).toBe("stripe")
    })
  })
})
