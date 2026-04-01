import { describe, it, expect, vi, beforeEach } from "vitest"
import { PaymentWebhookService } from "./PaymentWebhookService"
import type { PaymentWebhookDeps } from "./PaymentWebhookService"

function createDeps(overrides: Partial<PaymentWebhookDeps> = {}): PaymentWebhookDeps {
  return {
    findPaymentByProviderPaymentId: vi.fn().mockResolvedValue(null),
    updatePaymentStatus: vi.fn().mockResolvedValue(undefined),
    generateInvoiceNumber: vi.fn().mockReturnValue("EQ-202604-ABC123"),
    getBaseUrl: vi.fn().mockReturnValue("http://localhost:3000"),
    ...overrides,
  }
}

describe("PaymentWebhookService", () => {
  describe("handlePaymentIntentSucceeded", () => {
    it("updates payment to succeeded with invoice number", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-1",
          bookingId: "booking-1",
          status: "pending",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentSucceeded("pi_test_123", { bookingId: "booking-1" })

      expect(deps.updatePaymentStatus).toHaveBeenCalledWith("pay-1", {
        status: "succeeded",
        paidAt: expect.any(Date),
        invoiceNumber: "EQ-202604-ABC123",
        invoiceUrl: "http://localhost:3000/api/bookings/booking-1/receipt",
      })
    })

    it("does not update if payment not found", async () => {
      const deps = createDeps()
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentSucceeded("pi_unknown", {})

      expect(deps.updatePaymentStatus).not.toHaveBeenCalled()
    })

    it("does not update if payment already succeeded", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-1",
          bookingId: "booking-1",
          status: "succeeded",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentSucceeded("pi_test_123", { bookingId: "booking-1" })

      expect(deps.updatePaymentStatus).not.toHaveBeenCalled()
    })
  })

  describe("handlePaymentIntentFailed", () => {
    it("updates payment to failed", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-2",
          bookingId: "booking-2",
          status: "pending",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentFailed("pi_test_456", {})

      expect(deps.updatePaymentStatus).toHaveBeenCalledWith("pay-2", {
        status: "failed",
      })
    })

    it("does not update if payment not found", async () => {
      const deps = createDeps()
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentFailed("pi_unknown", {})

      expect(deps.updatePaymentStatus).not.toHaveBeenCalled()
    })

    it("does not update if payment already in terminal state", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-2",
          bookingId: "booking-2",
          status: "succeeded",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentFailed("pi_test_456", {})

      expect(deps.updatePaymentStatus).not.toHaveBeenCalled()
    })
  })
})
