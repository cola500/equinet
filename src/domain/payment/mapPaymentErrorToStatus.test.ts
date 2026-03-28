import { describe, it, expect } from "vitest"
import { mapPaymentErrorToStatus, mapPaymentErrorToMessage } from "./mapPaymentErrorToStatus"
import type { PaymentError } from "./PaymentService"

describe("mapPaymentErrorToStatus", () => {
  it("maps BOOKING_NOT_FOUND to 404", () => {
    expect(mapPaymentErrorToStatus({ type: "BOOKING_NOT_FOUND" })).toBe(404)
  })

  it("maps ALREADY_PAID to 400", () => {
    expect(mapPaymentErrorToStatus({ type: "ALREADY_PAID" })).toBe(400)
  })

  it("maps INVALID_STATUS to 400", () => {
    expect(mapPaymentErrorToStatus({ type: "INVALID_STATUS", status: "pending" })).toBe(400)
  })

  it("maps GATEWAY_FAILED to 402", () => {
    expect(mapPaymentErrorToStatus({ type: "GATEWAY_FAILED", message: "fail" })).toBe(402)
  })
})

describe("mapPaymentErrorToMessage", () => {
  it("returns correct message for BOOKING_NOT_FOUND", () => {
    expect(mapPaymentErrorToMessage({ type: "BOOKING_NOT_FOUND" })).toBe(
      "Bokning hittades inte"
    )
  })

  it("returns correct message for ALREADY_PAID", () => {
    expect(mapPaymentErrorToMessage({ type: "ALREADY_PAID" })).toBe(
      "Bokningen är redan betald"
    )
  })

  it("returns correct message for INVALID_STATUS", () => {
    expect(mapPaymentErrorToMessage({ type: "INVALID_STATUS", status: "pending" })).toBe(
      "Bokningen måste vara bekräftad innan betalning kan göras"
    )
  })

  it("returns gateway error message when provided", () => {
    const error: PaymentError = { type: "GATEWAY_FAILED", message: "Insufficient funds" }
    expect(mapPaymentErrorToMessage(error)).toBe("Insufficient funds")
  })

  it("returns fallback message when gateway error has no message", () => {
    const error: PaymentError = { type: "GATEWAY_FAILED" }
    expect(mapPaymentErrorToMessage(error)).toBe("Betalningen misslyckades")
  })
})
