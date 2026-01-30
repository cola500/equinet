/**
 * AccountingGateway - Abstraction for accounting/invoicing integration
 *
 * Defines a common interface for accounting providers (Fortnox, etc.).
 * Currently MockAccountingGateway is used in development.
 * When connecting to Fortnox, FortnoxGateway implements this interface.
 *
 * Pattern follows PaymentGateway: gateway interface + factory function.
 */

// --- Types ---

export interface InvoiceData {
  bookingId: string
  customerName: string
  customerEmail: string
  providerName: string
  serviceName: string
  amount: number
  currency: string
  bookingDate: string // ISO date
  description?: string
}

export interface InvoiceResult {
  success: boolean
  externalId: string // Fortnox invoice number / mock ID
  status: InvoiceStatus
  invoiceUrl?: string
  error?: string
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled" | "error"

export interface InvoiceFilter {
  providerId?: string
  status?: InvoiceStatus
  fromDate?: string
  toDate?: string
}

export interface Invoice {
  externalId: string
  status: InvoiceStatus
  amount: number
  currency: string
  customerName: string
  createdAt: string
  paidAt?: string
}

export type AccountingError =
  | { type: "NOT_CONNECTED"; message: string }
  | { type: "API_ERROR"; message: string; statusCode?: number }
  | { type: "INVALID_DATA"; message: string }
  | { type: "TOKEN_EXPIRED"; message: string }

// --- Interface ---

export interface IAccountingGateway {
  createInvoice(data: InvoiceData): Promise<InvoiceResult>
  getInvoiceStatus(externalId: string): Promise<InvoiceStatus>
  listInvoices(filter: InvoiceFilter): Promise<Invoice[]>
}

// --- Mock implementation ---

export class MockAccountingGateway implements IAccountingGateway {
  private invoices: Map<string, Invoice> = new Map()

  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    const externalId = `MOCK-INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const invoice: Invoice = {
      externalId,
      status: "draft",
      amount: data.amount,
      currency: data.currency,
      customerName: data.customerName,
      createdAt: new Date().toISOString(),
    }

    this.invoices.set(externalId, invoice)

    return {
      success: true,
      externalId,
      status: "draft",
    }
  }

  async getInvoiceStatus(externalId: string): Promise<InvoiceStatus> {
    const invoice = this.invoices.get(externalId)
    return invoice?.status || "error"
  }

  async listInvoices(filter: InvoiceFilter): Promise<Invoice[]> {
    let invoices = Array.from(this.invoices.values())

    if (filter.status) {
      invoices = invoices.filter((i) => i.status === filter.status)
    }

    return invoices
  }
}

/**
 * Factory function to get the appropriate accounting gateway.
 * Currently returns MockAccountingGateway.
 * When Fortnox is configured:
 *   ACCOUNTING_PROVIDER=fortnox -> new FortnoxGateway(...)
 */
export function getAccountingGateway(): IAccountingGateway {
  // Future: check env and return FortnoxGateway when configured
  return new MockAccountingGateway()
}
