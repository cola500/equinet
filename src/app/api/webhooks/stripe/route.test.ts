import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock dependencies BEFORE imports
const mockHandleWebhookEvent = vi.fn()
const mockVerifyWebhookSignature = vi.fn()
const mockHandlePaymentIntentSucceeded = vi.fn()
const mockHandlePaymentIntentFailed = vi.fn()

vi.mock("@/domain/subscription/SubscriptionGateway", () => ({
  getSubscriptionGateway: () => ({
    verifyWebhookSignature: mockVerifyWebhookSignature,
  }),
}))

vi.mock("@/domain/subscription/SubscriptionServiceFactory", () => ({
  createSubscriptionService: () => ({
    handleWebhookEvent: mockHandleWebhookEvent,
  }),
}))

vi.mock("@/domain/payment", () => ({
  createPaymentWebhookService: () => ({
    handlePaymentIntentSucceeded: mockHandlePaymentIntentSucceeded,
    handlePaymentIntentFailed: mockHandlePaymentIntentFailed,
  }),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { POST } from "./route"

function createWebhookRequest(
  body: string,
  signature: string = "whsec_test_signature"
): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body,
  })
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 when signature verification fails", async () => {
    mockVerifyWebhookSignature.mockReturnValue(null)

    const request = createWebhookRequest(
      JSON.stringify({ type: "checkout.session.completed", data: {} }),
      "invalid_signature"
    )
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig signatur")
  })

  it("passes body and signature to verifyWebhookSignature", async () => {
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: { subscription: "sub_123" },
    })
    mockVerifyWebhookSignature.mockReturnValue({
      type: "checkout.session.completed",
      data: { subscription: "sub_123" },
    })
    mockHandleWebhookEvent.mockResolvedValue(undefined)

    const request = createWebhookRequest(body, "whsec_test_sig_abc")
    await POST(request)

    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      body,
      "whsec_test_sig_abc"
    )
  })

  it("returns 200 and processes event on valid webhook", async () => {
    const webhookEvent = {
      type: "customer.subscription.updated",
      data: {
        id: "sub_123",
        status: "active",
        cancel_at_period_end: false,
      },
    }
    mockVerifyWebhookSignature.mockReturnValue(webhookEvent)
    mockHandleWebhookEvent.mockResolvedValue(undefined)

    const request = createWebhookRequest(JSON.stringify(webhookEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(mockHandleWebhookEvent).toHaveBeenCalledWith(webhookEvent)
  })

  it("returns 500 on handler error", async () => {
    const webhookEvent = {
      type: "checkout.session.completed",
      data: { subscription: "sub_123" },
    }
    mockVerifyWebhookSignature.mockReturnValue(webhookEvent)
    mockHandleWebhookEvent.mockRejectedValue(new Error("Database error"))

    const request = createWebhookRequest(JSON.stringify(webhookEvent))
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe("Webhook-hanteringsfel")
  })

  it("handles missing stripe-signature header gracefully", async () => {
    mockVerifyWebhookSignature.mockReturnValue(null)

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test", data: {} }),
      }
    )
    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
      expect.any(String),
      ""
    )
  })

  it("routes payment_intent.succeeded to PaymentWebhookService", async () => {
    const webhookEvent = {
      type: "payment_intent.succeeded",
      data: {
        id: "pi_test_123",
        metadata: { bookingId: "booking-1" },
      },
    }
    mockVerifyWebhookSignature.mockReturnValue(webhookEvent)
    mockHandlePaymentIntentSucceeded.mockResolvedValue(undefined)

    const request = createWebhookRequest(JSON.stringify(webhookEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockHandlePaymentIntentSucceeded).toHaveBeenCalledWith(
      "pi_test_123",
      { bookingId: "booking-1" }
    )
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled()
  })

  it("routes payment_intent.payment_failed to PaymentWebhookService", async () => {
    const webhookEvent = {
      type: "payment_intent.payment_failed",
      data: {
        id: "pi_test_456",
        metadata: { bookingId: "booking-2" },
      },
    }
    mockVerifyWebhookSignature.mockReturnValue(webhookEvent)
    mockHandlePaymentIntentFailed.mockResolvedValue(undefined)

    const request = createWebhookRequest(JSON.stringify(webhookEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockHandlePaymentIntentFailed).toHaveBeenCalledWith(
      "pi_test_456",
      { bookingId: "booking-2" }
    )
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled()
  })

  it("routes subscription events to SubscriptionService (unchanged)", async () => {
    const webhookEvent = {
      type: "customer.subscription.updated",
      data: { id: "sub_123", status: "active" },
    }
    mockVerifyWebhookSignature.mockReturnValue(webhookEvent)
    mockHandleWebhookEvent.mockResolvedValue(undefined)

    const request = createWebhookRequest(JSON.stringify(webhookEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockHandleWebhookEvent).toHaveBeenCalledWith(webhookEvent)
    expect(mockHandlePaymentIntentSucceeded).not.toHaveBeenCalled()
    expect(mockHandlePaymentIntentFailed).not.toHaveBeenCalled()
  })
})
