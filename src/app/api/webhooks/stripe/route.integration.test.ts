/**
 * Integration tests for POST /api/webhooks/stripe (payment events)
 *
 * BDD outer loop: Route -> PaymentWebhookService -> Prisma (mocked)
 * Tests the full chain for payment_intent.succeeded and payment_intent.payment_failed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// --- Mock Prisma ---

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

// Mock subscription gateway (for signature verification)
const mockVerifyWebhookSignature = vi.fn()
vi.mock("@/domain/subscription/SubscriptionGateway", () => ({
  getSubscriptionGateway: () => ({
    verifyWebhookSignature: mockVerifyWebhookSignature,
  }),
}))

// Mock subscription service (not under test, but needed by route)
vi.mock("@/domain/subscription/SubscriptionServiceFactory", () => ({
  createSubscriptionService: () => ({
    handleWebhookEvent: vi.fn(),
  }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// DO NOT mock @/domain/payment -- let real PaymentWebhookService run

import { prisma } from "@/lib/prisma"
import { POST } from "./route"

function createWebhookRequest(body: string, signature = "whsec_test"): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body,
  })
}

describe("POST /api/webhooks/stripe -- payment integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("payment_intent.succeeded", () => {
    it("updates payment to succeeded with invoice number", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: {
          id: "pi_test_success",
          metadata: { bookingId: "booking-42" },
        },
      }
      mockVerifyWebhookSignature.mockReturnValue(event)

      // Simulate existing pending payment in DB
      vi.mocked(prisma.payment.findFirst).mockResolvedValue({
        id: "pay-42",
        bookingId: "booking-42",
        status: "pending",
      } as never)
      vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never)

      const res = await POST(createWebhookRequest(JSON.stringify(event)))

      expect(res.status).toBe(200)
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { providerPaymentId: "pi_test_success" },
        select: { id: true, bookingId: true, status: true },
      })
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: "pay-42",
          status: { notIn: ["succeeded", "failed"] },
        },
        data: expect.objectContaining({
          status: "succeeded",
          paidAt: expect.any(Date),
          invoiceNumber: expect.stringMatching(/^EQ-/),
          invoiceUrl: expect.stringContaining("/api/bookings/booking-42/receipt"),
        }),
      })
    })

    it("skips update when payment already succeeded", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: { id: "pi_already_done", metadata: {} },
      }
      mockVerifyWebhookSignature.mockReturnValue(event)

      vi.mocked(prisma.payment.findFirst).mockResolvedValue({
        id: "pay-99",
        bookingId: "booking-99",
        status: "succeeded",
      } as never)

      const res = await POST(createWebhookRequest(JSON.stringify(event)))

      expect(res.status).toBe(200)
      expect(prisma.payment.updateMany).not.toHaveBeenCalled()
    })

    it("handles missing payment gracefully (returns 200)", async () => {
      const event = {
        type: "payment_intent.succeeded",
        data: { id: "pi_orphan", metadata: {} },
      }
      mockVerifyWebhookSignature.mockReturnValue(event)
      vi.mocked(prisma.payment.findFirst).mockResolvedValue(null as never)

      const res = await POST(createWebhookRequest(JSON.stringify(event)))

      // Returns 200 -- Stripe should not retry
      expect(res.status).toBe(200)
      expect(prisma.payment.updateMany).not.toHaveBeenCalled()
    })
  })

  describe("payment_intent.payment_failed", () => {
    it("updates payment to failed", async () => {
      const event = {
        type: "payment_intent.payment_failed",
        data: { id: "pi_test_fail", metadata: {} },
      }
      mockVerifyWebhookSignature.mockReturnValue(event)

      vi.mocked(prisma.payment.findFirst).mockResolvedValue({
        id: "pay-fail",
        bookingId: "booking-fail",
        status: "pending",
      } as never)
      vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never)

      const res = await POST(createWebhookRequest(JSON.stringify(event)))

      expect(res.status).toBe(200)
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: "pay-fail",
          status: { notIn: ["succeeded", "failed"] },
        },
        data: { status: "failed" },
      })
    })

    it("does not overwrite succeeded payment", async () => {
      const event = {
        type: "payment_intent.payment_failed",
        data: { id: "pi_late_fail", metadata: {} },
      }
      mockVerifyWebhookSignature.mockReturnValue(event)

      vi.mocked(prisma.payment.findFirst).mockResolvedValue({
        id: "pay-ok",
        bookingId: "booking-ok",
        status: "succeeded",
      } as never)

      const res = await POST(createWebhookRequest(JSON.stringify(event)))

      expect(res.status).toBe(200)
      expect(prisma.payment.updateMany).not.toHaveBeenCalled()
    })
  })
})
