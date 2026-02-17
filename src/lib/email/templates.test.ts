import { describe, it, expect } from "vitest"
import { bookingConfirmationEmail, bookingStatusChangeEmail, bookingRescheduleEmail } from "./templates"
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

const mockRescheduleData = {
  customerName: "Anna Svensson",
  serviceName: "Hovbeläggning",
  businessName: "Eriks Hovslagerservice",
  oldBookingDate: "15 mars 2026",
  oldStartTime: "10:00",
  newBookingDate: "17 mars 2026",
  newStartTime: "14:00",
  newEndTime: "15:00",
  bookingUrl: "http://localhost:3000/customer/bookings",
  requiresApproval: false,
}

describe("bookingRescheduleEmail", () => {
  it("includes old and new booking times in HTML", () => {
    const { html } = bookingRescheduleEmail(mockRescheduleData)
    expect(html).toContain(mockRescheduleData.oldBookingDate)
    expect(html).toContain(mockRescheduleData.oldStartTime)
    expect(html).toContain(mockRescheduleData.newBookingDate)
    expect(html).toContain(mockRescheduleData.newStartTime)
    expect(html).toContain(mockRescheduleData.newEndTime)
  })

  it("includes old and new booking times in plaintext", () => {
    const { text } = bookingRescheduleEmail(mockRescheduleData)
    expect(text).toContain(mockRescheduleData.oldBookingDate)
    expect(text).toContain(mockRescheduleData.oldStartTime)
    expect(text).toContain(mockRescheduleData.newBookingDate)
    expect(text).toContain(mockRescheduleData.newStartTime)
  })

  it("includes customer name and service details", () => {
    const { html } = bookingRescheduleEmail(mockRescheduleData)
    expect(html).toContain(mockRescheduleData.customerName)
    expect(html).toContain(mockRescheduleData.serviceName)
    expect(html).toContain(mockRescheduleData.businessName)
  })

  it("shows confirmation message when no approval required", () => {
    const { html } = bookingRescheduleEmail({ ...mockRescheduleData, requiresApproval: false })
    expect(html).toContain("bekräftad")
    expect(html).not.toContain("godkännande")
  })

  it("shows approval pending message when approval required", () => {
    const { html } = bookingRescheduleEmail({ ...mockRescheduleData, requiresApproval: true })
    expect(html).toContain("godkännande")
  })

  it("includes booking URL", () => {
    const { html } = bookingRescheduleEmail(mockRescheduleData)
    expect(html).toContain(mockRescheduleData.bookingUrl)
  })
})
