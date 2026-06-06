import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock the Stripe SDK so we control constructEvent without real signatures.
const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    webhooks = { constructEvent: mockConstructEvent }
  },
}))

import { verifyStripeWebhook } from "./StripeWebhookVerifier"

const ORIGINAL_ENV = { ...process.env }

describe("verifyStripeWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy"
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy"
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("returns a normalized event with data = event.data.object on a valid signature", () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", metadata: { bookingId: "booking-1" } } },
    })

    const result = verifyStripeWebhook("{}", "sig_valid")

    expect(result).toEqual({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { id: "pi_1", metadata: { bookingId: "booking-1" } },
    })
    expect(mockConstructEvent).toHaveBeenCalledWith("{}", "sig_valid", "whsec_dummy")
  })

  it("exposes the PaymentIntent id at data.id (not nested under data.object)", () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_2",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_xyz", metadata: {} } },
    })

    const result = verifyStripeWebhook("{}", "sig")

    // The route reads event.data.id — this is the exact field the mock gateway got wrong.
    expect(result?.data.id).toBe("pi_xyz")
  })

  it("returns null when the signature is invalid (constructEvent throws)", () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature")
    })

    expect(verifyStripeWebhook("{}", "sig_bad")).toBeNull()
  })

  it("returns null and does not call Stripe when STRIPE_SECRET_KEY is missing", () => {
    delete process.env.STRIPE_SECRET_KEY

    expect(verifyStripeWebhook("{}", "sig")).toBeNull()
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  it("returns null when STRIPE_WEBHOOK_SECRET is missing", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    expect(verifyStripeWebhook("{}", "sig")).toBeNull()
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  it("verifies independently of SUBSCRIPTION_PROVIDER (works when it is not 'stripe')", () => {
    // This is the regression guard: payment webhooks must NOT depend on
    // subscription provider config. The verifier never reads SUBSCRIPTION_PROVIDER.
    process.env.SUBSCRIPTION_PROVIDER = "mock"
    mockConstructEvent.mockReturnValue({
      id: "evt_3",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_indep", metadata: { bookingId: "b-2" } } },
    })

    const result = verifyStripeWebhook("{}", "sig")

    expect(result?.type).toBe("payment_intent.succeeded")
    expect(result?.data.id).toBe("pi_indep")
  })
})
