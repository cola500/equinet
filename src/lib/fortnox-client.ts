/**
 * Fortnox API HTTP client
 *
 * REST wrapper for the Fortnox v3 API.
 * No external SDK needed - uses native fetch.
 *
 * Docs: https://developer.fortnox.se/documentation/
 */

import { logger } from "@/lib/logger"

const FORTNOX_API_BASE = "https://api.fortnox.se/3"

export interface FortnoxTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export interface FortnoxInvoice {
  DocumentNumber: string
  CustomerNumber: string
  InvoiceDate: string
  DueDate: string
  TotalAmount: number
  Currency: string
  Booked: boolean
  Cancelled: boolean
  Sent: boolean
  InvoiceRows: Array<{
    Description: string
    DeliveredQuantity: number
    Price: number
    AccountNumber?: number
  }>
}

export interface FortnoxCreateInvoiceRequest {
  Invoice: {
    CustomerNumber: string
    InvoiceDate: string
    DueDate: string
    Currency: string
    InvoiceRows: Array<{
      Description: string
      DeliveredQuantity: number
      Price: number
    }>
  }
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<FortnoxTokenResponse> {
  const response = await fetch("https://apps.fortnox.se/oauth-v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error("Fortnox token exchange failed", { status: response.status, error })
    throw new Error(`Fortnox token exchange failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<FortnoxTokenResponse> {
  const response = await fetch("https://apps.fortnox.se/oauth-v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error("Fortnox token refresh failed", { status: response.status, error })
    throw new Error(`Fortnox token refresh failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Make an authenticated API call to Fortnox.
 */
async function fortnoxFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${FORTNOX_API_BASE}${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })

  return response
}

/**
 * Create an invoice in Fortnox.
 */
export async function createFortnoxInvoice(
  accessToken: string,
  invoice: FortnoxCreateInvoiceRequest
): Promise<FortnoxInvoice> {
  const response = await fortnoxFetch("/invoices", accessToken, {
    method: "POST",
    body: JSON.stringify(invoice),
  })

  if (!response.ok) {
    const error = await response.text()
    logger.error("Fortnox create invoice failed", {
      status: response.status,
      error,
    })
    throw new Error(`Fortnox create invoice failed: ${response.status}`)
  }

  const data = await response.json()
  return data.Invoice
}

/**
 * Get invoice status from Fortnox.
 */
export async function getFortnoxInvoice(
  accessToken: string,
  invoiceNumber: string
): Promise<FortnoxInvoice> {
  const response = await fortnoxFetch(
    `/invoices/${invoiceNumber}`,
    accessToken
  )

  if (!response.ok) {
    throw new Error(`Fortnox get invoice failed: ${response.status}`)
  }

  const data = await response.json()
  return data.Invoice
}

/**
 * List invoices from Fortnox with optional filters.
 */
export async function listFortnoxInvoices(
  accessToken: string,
  params?: { fromdate?: string; todate?: string }
): Promise<FortnoxInvoice[]> {
  const searchParams = new URLSearchParams()
  if (params?.fromdate) searchParams.set("fromdate", params.fromdate)
  if (params?.todate) searchParams.set("todate", params.todate)

  const queryString = searchParams.toString()
  const path = `/invoices${queryString ? `?${queryString}` : ""}`

  const response = await fortnoxFetch(path, accessToken)

  if (!response.ok) {
    throw new Error(`Fortnox list invoices failed: ${response.status}`)
  }

  const data = await response.json()
  return data.Invoices?.InvoiceSubset || []
}
