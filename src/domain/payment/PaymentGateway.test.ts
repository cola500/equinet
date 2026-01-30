import { describe, it, expect } from "vitest"
import {
  MockPaymentGateway,
  type PaymentRequest,
} from "./PaymentGateway"

describe("MockPaymentGateway", () => {
  const gateway = new MockPaymentGateway()

  describe("initiatePayment", () => {
    it("should return a successful payment result", async () => {
      const request: PaymentRequest = {
        bookingId: "booking-1",
        amount: 1500,
        currency: "SEK",
        description: "Hovslagning",
      }

      const result = await gateway.initiatePayment(request)

      expect(result.success).toBe(true)
      expect(result.providerPaymentId).toBeDefined()
      expect(result.providerPaymentId).toMatch(/^mock_pay_/)
      expect(result.status).toBe("succeeded")
      expect(result.paidAt).toBeInstanceOf(Date)
    })

    it("should generate unique payment IDs for each call", async () => {
      const request: PaymentRequest = {
        bookingId: "booking-1",
        amount: 500,
        currency: "SEK",
        description: "Massage",
      }

      const result1 = await gateway.initiatePayment(request)
      const result2 = await gateway.initiatePayment(request)

      expect(result1.providerPaymentId).not.toBe(result2.providerPaymentId)
    })
  })

  describe("checkStatus", () => {
    it("should return succeeded for any mock payment ID", async () => {
      const result = await gateway.checkStatus("mock_pay_abc123")

      expect(result.success).toBe(true)
      expect(result.status).toBe("succeeded")
      expect(result.providerPaymentId).toBe("mock_pay_abc123")
    })
  })
})
