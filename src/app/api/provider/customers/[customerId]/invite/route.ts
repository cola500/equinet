import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { sendCustomerInviteNotification } from "@/lib/email"
import { logger } from "@/lib/logger"
import { randomBytes } from "crypto"

type RouteContext = { params: Promise<{ customerId: string }> }

// POST /api/provider/customers/[customerId]/invite
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
        { status: 403 }
      )
    }

    if (!(await isFeatureEnabled("customer_invite"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    const { customerId } = await context.params
    const providerId = session.user.providerId

    // IDOR-check: verify customer belongs to this provider
    const link = await prisma.providerCustomer.findUnique({
      where: {
        providerId_customerId: { providerId, customerId },
      },
    })

    if (!link) {
      return NextResponse.json(
        { error: "Kunden finns inte i ditt kundregister" },
        { status: 404 }
      )
    }

    // Get customer details
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        isManualCustomer: true,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: "Kunden finns inte" },
        { status: 404 }
      )
    }

    // Already has a real account
    if (!customer.isManualCustomer) {
      return NextResponse.json(
        { error: "Kunden har redan ett aktiverat konto" },
        { status: 409 }
      )
    }

    // Sentinel email -- cannot invite
    if (customer.email.endsWith("@ghost.equinet.se")) {
      return NextResponse.json(
        { error: "Kunden har ingen riktig e-postadress. Lägg till en e-post först." },
        { status: 400 }
      )
    }

    // Get provider business name for the email
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { businessName: true },
    })

    // Invalidate old tokens
    await prisma.customerInviteToken.updateMany({
      where: { userId: customerId, usedAt: null },
      data: { usedAt: new Date() },
    })

    // Create new token (7 days expiry)
    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.customerInviteToken.create({
      data: {
        token,
        userId: customerId,
        invitedByProviderId: providerId,
        expiresAt,
      },
    })

    // Send invite email (fire-and-forget)
    sendCustomerInviteNotification(
      customer.email,
      customer.firstName,
      provider?.businessName || "En leverantör",
      token
    ).catch((err) => {
      logger.error("Failed to send invite email", err instanceof Error ? err : new Error(String(err)))
    })

    return NextResponse.json({ message: "Inbjudan har skickats" })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to send customer invite",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte skicka inbjudan" },
      { status: 500 }
    )
  }
}
