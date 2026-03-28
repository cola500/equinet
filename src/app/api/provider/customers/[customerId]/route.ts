import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { logger } from "@/lib/logger"

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
}).strict()

function extractCustomerId(pathname: string): string {
  // /api/provider/customers/[customerId] -> segment at index 4
  const segments = pathname.split('/')
  return segments[4]
}

// PUT /api/provider/customers/[customerId] -- Update customer info
export const PUT = withApiHandler(
  { auth: "provider", schema: updateCustomerSchema },
  async ({ user, body, request }) => {
    const { providerId } = user
    const customerId = extractCustomerId(request.nextUrl.pathname)

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
        firstName: body.firstName,
        lastName: body.lastName || "",
        phone: body.phone || null,
        email: body.email || undefined,
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
  },
)

// DELETE /api/provider/customers/[customerId] -- Remove manually added customer
export const DELETE = withApiHandler(
  { auth: "provider" },
  async ({ user, request }) => {
    const { providerId } = user
    const customerId = extractCustomerId(request.nextUrl.pathname)

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
      const ghostUser = await prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, isManualCustomer: true },
      })

      if (ghostUser?.isManualCustomer) {
        await prisma.user.delete({ where: { id: customerId } })
        logger.info("Ghost user cleaned up after customer removal", {
          ghostUserId: customerId,
        })
      }
    }

    return NextResponse.json({ message: "Kunden har tagits bort" })
  },
)
