import { describe, it, expect, vi, beforeEach } from "vitest"
import { PaymentWebhookService } from "./PaymentWebhookService"
import type { PaymentWebhookDeps } from "./PaymentWebhookService"

function createDeps(overrides: Partial<PaymentWebhookDeps> = {}): PaymentWebhookDeps {
  return {
    findPaymentByProviderPaymentId: vi.fn().mockResolvedValue(null),
    updatePaymentStatus: vi.fn().mockResolvedValue(1),
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

      expect(deps.updatePaymentStatus).toHaveBeenCalledWith(
        "pay-1",
        {
          status: "succeeded",
          paidAt: expect.any(Date),
          invoiceNumber: "EQ-202604-ABC123",
          invoiceUrl: "http://localhost:3000/api/bookings/booking-1/receipt",
        },
        ["succeeded", "failed"]
      )
    })

    it("does not update if payment not found", async () => {
      const deps = createDeps()
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentSucceeded("pi_unknown", {})

      expect(deps.updatePaymentStatus).not.toHaveBeenCalled()
    })

    it("does not update if payment already in terminal state (succeeded)", async () => {
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
      expect(deps.generateInvoiceNumber).not.toHaveBeenCalled()
    })

    it("does not update if payment already in terminal state (failed)", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-1",
          bookingId: "booking-1",
          status: "failed",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentSucceeded("pi_test_123", { bookingId: "booking-1" })

      expect(deps.updatePaymentStatus).not.toHaveBeenCalled()
      expect(deps.generateInvoiceNumber).not.toHaveBeenCalled()
    })

    it("passes atomic guard for both terminal states to updatePaymentStatus", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-1",
          bookingId: "booking-1",
          status: "pending",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentSucceeded("pi_test_123", { bookingId: "booking-1" })

      // Third argument is the guard: don't update if already in terminal state
      expect(deps.updatePaymentStatus).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        ["succeeded", "failed"]
      )
    })

    it("handles concurrent duplicate events safely", async () => {
      let callCount = 0
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-1",
          bookingId: "booking-1",
          status: "pending",
        }),
        // Simulate atomic DB guard: first call wins, second returns 0
        updatePaymentStatus: vi.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve(callCount === 1 ? 1 : 0)
        }),
      })
      const service = new PaymentWebhookService(deps)

      // Two concurrent webhook deliveries for the same event
      const [result1, result2] = await Promise.all([
        service.handlePaymentIntentSucceeded("pi_test_123", { bookingId: "booking-1" }),
        service.handlePaymentIntentSucceeded("pi_test_123", { bookingId: "booking-1" }),
      ])

      // Both complete without error
      expect(result1).toBeUndefined()
      expect(result2).toBeUndefined()

      // Both passed the read-check (status was pending), so both called update
      // But the atomic guard ensures only one actually modified the row
      expect(deps.updatePaymentStatus).toHaveBeenCalledTimes(2)
    })
  })

  describe("handlePaymentIntentFailed", () => {
    it("updates payment to failed with atomic guard", async () => {
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-2",
          bookingId: "booking-2",
          status: "pending",
        }),
      })
      const service = new PaymentWebhookService(deps)

      await service.handlePaymentIntentFailed("pi_test_456", {})

      expect(deps.updatePaymentStatus).toHaveBeenCalledWith(
        "pay-2",
        { status: "failed" },
        ["succeeded", "failed"]
      )
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

    it("handles concurrent duplicate failed events safely", async () => {
      let callCount = 0
      const deps = createDeps({
        findPaymentByProviderPaymentId: vi.fn().mockResolvedValue({
          id: "pay-2",
          bookingId: "booking-2",
          status: "pending",
        }),
        updatePaymentStatus: vi.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve(callCount === 1 ? 1 : 0)
        }),
      })
      const service = new PaymentWebhookService(deps)

      await Promise.all([
        service.handlePaymentIntentFailed("pi_test_456", {}),
        service.handlePaymentIntentFailed("pi_test_456", {}),
      ])

      expect(deps.updatePaymentStatus).toHaveBeenCalledTimes(2)
    })
  })
})
