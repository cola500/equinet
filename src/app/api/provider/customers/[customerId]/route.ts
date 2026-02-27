import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
}).strict()

type RouteContext = { params: Promise<{ customerId: string }> }

// PUT /api/provider/customers/[customerId] -- Update customer info
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "provider" || !session.user.providerId) {
      return NextResponse.json(
        { error: "Åtkomst nekad" },
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

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const validated = updateCustomerSchema.parse(body)

    const { customerId } = await context.params
    const providerId = session.user.providerId

    // IDOR-safe: verify customer belongs to this provider
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

    const updated = await prisma.user.update({
      where: { id: customerId },
      data: {
        firstName: validated.firstName,
        lastName: validated.lastName || "",
        phone: validated.phone || null,
        email: validated.email || undefined,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Response) return error

    logger.error(
      "Failed to update customer",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte uppdatera kund" },
      { status: 500 }
    )
  }
}

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
