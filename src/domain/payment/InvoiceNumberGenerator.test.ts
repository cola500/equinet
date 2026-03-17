import { describe, it, expect } from "vitest"
import { generateInvoiceNumber } from "./InvoiceNumberGenerator"

describe("generateInvoiceNumber", () => {
  it("returns string matching EQ-YYYYMM-XXXXXX format", () => {
    const invoice = generateInvoiceNumber()
    expect(invoice).toMatch(/^EQ-\d{6}-[A-Z0-9]{6}$/)
  })

  it("uses current year and month", () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const expectedPrefix = `EQ-${year}${month}-`

    const invoice = generateInvoiceNumber()
    expect(invoice.startsWith(expectedPrefix)).toBe(true)
  })

  it("generates unique suffixes across multiple calls", () => {
    const invoices = new Set<string>()
    for (let i = 0; i < 10; i++) {
      invoices.add(generateInvoiceNumber())
    }
    expect(invoices.size).toBe(10)
  })
})
