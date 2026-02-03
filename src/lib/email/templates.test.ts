import { describe, it, expect } from "vitest"
import { bookingConfirmationEmail, bookingStatusChangeEmail } from "./templates"
import { PREPARATION_CHECKLIST } from "@/lib/preparation-checklist"

const mockBookingData = {
  customerName: "Anna Svensson",
  serviceName: "Hovbeläggning",
  providerName: "Erik Hovslagare",
  businessName: "Eriks Hovslagerservice",
  bookingDate: "2026-03-15",
  startTime: "10:00",
  endTime: "11:00",
  price: 1500,
  bookingId: "booking-123",
}

const mockStatusChangeData = {
  customerName: "Anna Svensson",
  serviceName: "Hovbeläggning",
  providerName: "Erik Hovslagare",
  businessName: "Eriks Hovslagerservice",
  bookingDate: "2026-03-15",
  startTime: "10:00",
  newStatus: "confirmed",
  statusLabel: "Bekräftad",
}

describe("bookingConfirmationEmail", () => {
  it("does not include preparation checklist", () => {
    const { html, text } = bookingConfirmationEmail(mockBookingData)
    expect(html).not.toContain("Inför besöket")
    expect(text).not.toContain("INFÖR BESÖKET")
  })

  it("includes booking details in HTML", () => {
    const { html } = bookingConfirmationEmail(mockBookingData)
    expect(html).toContain(mockBookingData.customerName)
    expect(html).toContain(mockBookingData.serviceName)
    expect(html).toContain(mockBookingData.businessName)
    expect(html).toContain(`${mockBookingData.price} kr`)
  })
})

describe("bookingStatusChangeEmail", () => {
  it("includes preparation checklist when status is confirmed (HTML)", () => {
    const { html } = bookingStatusChangeEmail(mockStatusChangeData)
    expect(html).toContain("Inför besöket")
    for (const item of PREPARATION_CHECKLIST) {
      expect(html).toContain(item)
    }
  })

  it("includes preparation checklist when status is confirmed (plaintext)", () => {
    const { text } = bookingStatusChangeEmail(mockStatusChangeData)
    expect(text).toContain("INFÖR BESÖKET")
    for (const item of PREPARATION_CHECKLIST) {
      expect(text).toContain(item)
    }
  })

  it("does not include preparation checklist for other statuses", () => {
    const cancelledData = { ...mockStatusChangeData, newStatus: "cancelled", statusLabel: "Avbokad" }
    const { html, text } = bookingStatusChangeEmail(cancelledData)
    expect(html).not.toContain("Inför besöket")
    expect(text).not.toContain("INFÖR BESÖKET")
  })

  it("includes booking details", () => {
    const { html } = bookingStatusChangeEmail(mockStatusChangeData)
    expect(html).toContain(mockStatusChangeData.customerName)
    expect(html).toContain(mockStatusChangeData.serviceName)
    expect(html).toContain(mockStatusChangeData.businessName)
    expect(html).toContain(mockStatusChangeData.statusLabel)
  })
})
