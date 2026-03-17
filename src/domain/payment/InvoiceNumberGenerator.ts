/**
 * Generate a unique invoice number in EQ-YYYYMM-XXXXXX format
 */
export function generateInvoiceNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `EQ-${year}${month}-${random}`
}
