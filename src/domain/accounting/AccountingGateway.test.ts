import { describe, it, expect } from "vitest"
import {
  MockAccountingGateway,
  getAccountingGateway,
  InvoiceData,
} from "./AccountingGateway"
import { mapBookingToInvoice, BookingForInvoice } from "./InvoiceMapper"

const sampleInvoiceData: InvoiceData = {
  bookingId: "booking-1",
  customerName: "Anna Svensson",
  customerEmail: "anna@test.se",
  providerName: "Magnus Hovslagar",
  serviceName: "Hovslagning",
  amount: 1500,
  currency: "SEK",
  bookingDate: "2026-02-15",
}

describe("MockAccountingGateway", () => {
  it("should create an invoice and return draft status", async () => {
    const gateway = new MockAccountingGateway()
    const result = await gateway.createInvoice(sampleInvoiceData)

    expect(result.success).toBe(true)
    expect(result.externalId).toMatch(/^MOCK-INV-/)
    expect(result.status).toBe("draft")
  })

  it("should return status for created invoice", async () => {
    const gateway = new MockAccountingGateway()
    const result = await gateway.createInvoice(sampleInvoiceData)

    const status = await gateway.getInvoiceStatus(result.externalId)
    expect(status).toBe("draft")
  })

  it("should return error status for unknown invoice", async () => {
    const gateway = new MockAccountingGateway()
    const status = await gateway.getInvoiceStatus("unknown-id")
    expect(status).toBe("error")
  })

  it("should list created invoices", async () => {
    const gateway = new MockAccountingGateway()
    await gateway.createInvoice(sampleInvoiceData)
    await gateway.createInvoice({
      ...sampleInvoiceData,
      bookingId: "booking-2",
    })

    const invoices = await gateway.listInvoices({})
    expect(invoices).toHaveLength(2)
  })

  it("should filter invoices by status", async () => {
    const gateway = new MockAccountingGateway()
    await gateway.createInvoice(sampleInvoiceData)

    const drafts = await gateway.listInvoices({ status: "draft" })
    expect(drafts).toHaveLength(1)

    const paid = await gateway.listInvoices({ status: "paid" })
    expect(paid).toHaveLength(0)
  })
})

describe("getAccountingGateway", () => {
  it("should return MockAccountingGateway", () => {
    const gateway = getAccountingGateway()
    expect(gateway).toBeInstanceOf(MockAccountingGateway)
  })
})

describe("InvoiceMapper", () => {
  it("should map booking to invoice data", () => {
    const booking: BookingForInvoice = {
      id: "booking-1",
      bookingDate: new Date("2026-02-15"),
      customer: {
        firstName: "Anna",
        lastName: "Svensson",
        email: "anna@test.se",
      },
      provider: { businessName: "Magnus Hovslagar" },
      service: { name: "Hovslagning", price: 1500 },
      payment: { amount: 1500, currency: "SEK" },
    }

    const result = mapBookingToInvoice(booking)

    expect(result).toEqual({
      bookingId: "booking-1",
      customerName: "Anna Svensson",
      customerEmail: "anna@test.se",
      providerName: "Magnus Hovslagar",
      serviceName: "Hovslagning",
      amount: 1500,
      currency: "SEK",
      bookingDate: "2026-02-15",
      description: "Hovslagning - 2026-02-15",
    })
  })

  it("should use service price when payment is missing", () => {
    const booking: BookingForInvoice = {
      id: "booking-2",
      bookingDate: "2026-02-15T00:00:00.000Z",
      customer: {
        firstName: "Anna",
        lastName: "Svensson",
        email: "anna@test.se",
      },
      provider: { businessName: "Magnus Hovslagar" },
      service: { name: "Massage", price: 800 },
    }

    const result = mapBookingToInvoice(booking)

    expect(result.amount).toBe(800)
    expect(result.currency).toBe("SEK")
  })
})
