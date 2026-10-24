import { NextResponse } from "next/server"
import { getPaymentProviderName } from "@/domain/payment/PaymentGateway"

/**
 * Test-only endpoint: which payment gateway this server instance uses.
 * E2E specs that pay call it first and abort before any payment unless the
 * server runs the mock gateway (or Stripe was explicitly opted in).
 *
 * BLOCKED unless ALLOW_TEST_ENDPOINTS env var is explicitly set.
 * Returns only the provider name, never keys or configuration.
 */
export async function GET() {
  if (!process.env.ALLOW_TEST_ENDPOINTS) {
    return new Response("Not found", { status: 404 })
  }

  return NextResponse.json({ provider: getPaymentProviderName() })
}
