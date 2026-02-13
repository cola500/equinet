import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

type RouteContext = { params: Promise<{ customerId: string }> }

// DELETE /api/provider/customers/[customerId] -- Remove manually added customer
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Bara leverantörer kan ta bort kunder" },
        { status: 403 }
      )
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

    // Atomic IDOR-safe lookup
    const link = await prisma.providerCustomer.findUnique({
      where: {
        providerId_customerId: {
          providerId,
          customerId,
        },
      },
    })

    if (!link) {
      return NextResponse.json(
        { error: "Kunden finns inte i ditt kundregister" },
        { status: 404 }
      )
    }

    // Delete the link
    await prisma.providerCustomer.delete({
      where: { id: link.id },
    })

    // Clean up ghost user if no bookings exist
    const bookingCount = await prisma.booking.count({
      where: { customerId },
    })

    if (bookingCount === 0) {
      const user = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, isManualCustomer: true },
      })

      if (user?.isManualCustomer) {
        await prisma.user.delete({ where: { id: customerId } })
        logger.info("Ghost user cleaned up after customer removal", {
          ghostUserId: customerId,
        })
      }
    }

    return NextResponse.json({ message: "Kunden har tagits bort" })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to delete customer",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte ta bort kund" },
      { status: 500 }
    )
  }
}
