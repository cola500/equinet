/**
 * FortnoxGateway - Implements IAccountingGateway for Fortnox
 *
 * Handles token management (encrypted storage, auto-refresh)
 * and maps between Equinet's invoice format and Fortnox API format.
 */

import {
  IAccountingGateway,
  InvoiceData,
  InvoiceResult,
  InvoiceStatus,
  InvoiceFilter,
  Invoice,
} from "./AccountingGateway"
import {
  createFortnoxInvoice,
  getFortnoxInvoice,
  listFortnoxInvoices,
  refreshAccessToken,
  FortnoxInvoice,
} from "@/lib/fortnox-client"
import { encrypt, decrypt } from "@/lib/encryption"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

interface FortnoxConfig {
  clientId: string
  clientSecret: string
}

function getFortnoxConfig(): FortnoxConfig {
  const clientId = process.env.FORTNOX_CLIENT_ID
  const clientSecret = process.env.FORTNOX_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Fortnox client ID and secret must be configured")
  }

  return { clientId, clientSecret }
}

export class FortnoxGateway implements IAccountingGateway {
  constructor(private providerId: string) {}

  /**
   * Get a valid access token for this provider.
   * Refreshes automatically if expired.
   */
  private async getAccessToken(): Promise<string> {
    const connection = await prisma.fortnoxConnection.findUnique({
      where: { providerId: this.providerId },
    })

    if (!connection) {
      throw new Error("Fortnox not connected for this provider")
    }

    // Check if token is expired (refresh 5 min before actual expiry)
    const isExpired =
      new Date() > new Date(connection.expiresAt.getTime() - 5 * 60 * 1000)

    if (isExpired) {
      const config = getFortnoxConfig()
      const decryptedRefreshToken = decrypt(connection.refreshToken)

      try {
        const tokens = await refreshAccessToken(
          decryptedRefreshToken,
          config.clientId,
          config.clientSecret
        )

        // Update stored tokens
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
        await prisma.fortnoxConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token),
            expiresAt,
          },
        })

        return tokens.access_token
      } catch (error) {
        logger.error("Fortnox token refresh failed", error as Error, {
          providerId: this.providerId,
        })
        throw new Error("Could not refresh Fortnox token")
      }
    }

    return decrypt(connection.accessToken)
  }

  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    try {
      const accessToken = await this.getAccessToken()

      // Map to Fortnox format
      const fortnoxInvoice = await createFortnoxInvoice(accessToken, {
        Invoice: {
          CustomerNumber: data.customerEmail, // Use email as customer ID
          InvoiceDate: data.bookingDate,
          DueDate: addDays(data.bookingDate, 30),
          Currency: data.currency,
          InvoiceRows: [
            {
              Description: data.description || data.serviceName,
              DeliveredQuantity: 1,
              Price: data.amount,
            },
          ],
        },
      })

      logger.info("Fortnox invoice created", {
        providerId: this.providerId,
        invoiceNumber: fortnoxInvoice.DocumentNumber,
        bookingId: data.bookingId,
      })

      return {
        success: true,
        externalId: fortnoxInvoice.DocumentNumber,
        status: mapFortnoxStatus(fortnoxInvoice),
      }
    } catch (error) {
      logger.error("Failed to create Fortnox invoice", error as Error, {
        providerId: this.providerId,
        bookingId: data.bookingId,
      })

      return {
        success: false,
        externalId: "",
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async getInvoiceStatus(externalId: string): Promise<InvoiceStatus> {
    try {
      const accessToken = await this.getAccessToken()
      const invoice = await getFortnoxInvoice(accessToken, externalId)
      return mapFortnoxStatus(invoice)
    } catch (error) {
      logger.error("Failed to get Fortnox invoice status", error as Error, {
        externalId,
      })
      return "error"
    }
  }

  async listInvoices(filter: InvoiceFilter): Promise<Invoice[]> {
    try {
      const accessToken = await this.getAccessToken()
      const invoices = await listFortnoxInvoices(accessToken, {
        fromdate: filter.fromDate,
        todate: filter.toDate,
      })

      return invoices.map((inv) => ({
        externalId: inv.DocumentNumber,
        status: mapFortnoxStatus(inv),
        amount: inv.TotalAmount,
        currency: inv.Currency,
        customerName: inv.CustomerNumber,
        createdAt: inv.InvoiceDate,
      }))
    } catch (error) {
      logger.error("Failed to list Fortnox invoices", error as Error)
      return []
    }
  }
}

// --- Helpers ---

function mapFortnoxStatus(invoice: FortnoxInvoice): InvoiceStatus {
  if (invoice.Cancelled) return "cancelled"
  if (invoice.Booked) return "paid" // Simplified: booked ~= paid
  if (invoice.Sent) return "sent"
  return "draft"
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}
