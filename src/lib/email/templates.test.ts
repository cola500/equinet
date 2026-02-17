import { describe, it, expect } from "vitest"
import { bookingConfirmationEmail, bookingStatusChangeEmail, bookingRescheduleEmail, bookingSeriesCreatedEmail } from "./templates"
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

describe("bookingSeriesCreatedEmail", () => {
  const mockSeriesData = {
    customerName: "Anna Svensson",
    serviceName: "Hovbeläggning",
    businessName: "Eriks Hovslagerservice",
    totalOccurrences: 4,
    createdCount: 3,
    intervalWeeks: 6,
    bookingDates: [
      { date: "15 mar 2026", time: "10:00" },
      { date: "26 apr 2026", time: "10:00" },
      { date: "7 jun 2026", time: "10:00" },
    ],
    skippedDates: [
      { date: "19 jul 2026", reason: "Tiden är upptagen" },
    ],
  }

  it("includes customer name and service in HTML", () => {
    const { html } = bookingSeriesCreatedEmail(mockSeriesData)
    expect(html).toContain("Anna Svensson")
    expect(html).toContain("Hovbeläggning")
    expect(html).toContain("Eriks Hovslagerservice")
  })

  it("shows created count vs total", () => {
    const { html } = bookingSeriesCreatedEmail(mockSeriesData)
    expect(html).toContain("3 av 4")
  })

  it("includes interval label", () => {
    const { html } = bookingSeriesCreatedEmail(mockSeriesData)
    expect(html).toContain("var 6:e vecka")
  })

  it("shows 'varje vecka' for interval 1", () => {
    const { html } = bookingSeriesCreatedEmail({ ...mockSeriesData, intervalWeeks: 1 })
    expect(html).toContain("varje vecka")
  })

  it("lists all booking dates", () => {
    const { html } = bookingSeriesCreatedEmail(mockSeriesData)
    expect(html).toContain("15 mar 2026")
    expect(html).toContain("26 apr 2026")
    expect(html).toContain("7 jun 2026")
  })

  it("shows skipped dates with reasons", () => {
    const { html } = bookingSeriesCreatedEmail(mockSeriesData)
    expect(html).toContain("19 jul 2026")
    expect(html).toContain("Tiden är upptagen")
  })

  it("omits skipped section when no dates were skipped", () => {
    const { html } = bookingSeriesCreatedEmail({ ...mockSeriesData, skippedDates: [] })
    expect(html).not.toContain("Hoppade datum")
  })

  it("includes plaintext version with all details", () => {
    const { text } = bookingSeriesCreatedEmail(mockSeriesData)
    expect(text).toContain("Anna Svensson")
    expect(text).toContain("Hovbeläggning")
    expect(text).toContain("3 av 4")
    expect(text).toContain("15 mar 2026")
  })
})
