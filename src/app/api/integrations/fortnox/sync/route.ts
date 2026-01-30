import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { getAccountingGateway } from "@/domain/accounting/AccountingGateway"
import { mapBookingToInvoice } from "@/domain/accounting/InvoiceMapper"

// POST /api/integrations/fortnox/sync - Sync unsynced invoices
export async function POST(request: NextRequest) {
  const clientIp = getClientIP(request)
  const isAllowed = await rateLimiters.api(clientIp)
  if (!isAllowed) {
    return NextResponse.json(
      { error: "For manga forfragningar. Forsok igen om en minut." },
      { status: 429 }
    )
  }

  try {
    const session = await auth()

    if (session.user.userType !== "provider") {
      return NextResponse.json(
        { error: "Bara leverantorer kan synka fakturor" },
        { status: 403 }
      )
    }

    const providerId = (session.user as any).providerId
    if (!providerId) {
      return NextResponse.json(
        { error: "Leverantör hittades inte" },
        { status: 404 }
      )
    }

    // Find completed bookings with payments that haven't been sent to Fortnox
    const unsyncedBookings = await prisma.booking.findMany({
      where: {
        providerId,
        status: "completed",
        payment: {
          status: "succeeded",
          fortnoxInvoiceId: null,
        },
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        provider: {
          select: { businessName: true },
        },
        service: {
          select: { name: true, price: true },
        },
        payment: true,
      },
    })

    if (unsyncedBookings.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "Inga osynkade bokningar",
      })
    }

    const gateway = getAccountingGateway()
    let synced = 0
    let failed = 0

    for (const booking of unsyncedBookings) {
      try {
        const invoiceData = mapBookingToInvoice(booking)
        const result = await gateway.createInvoice(invoiceData)

        if (result.success && booking.payment) {
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: {
              fortnoxInvoiceId: result.externalId,
              fortnoxStatus: result.status,
              sentToFortnoxAt: new Date(),
            },
          })
          synced++
        } else {
          failed++
        }
      } catch (error) {
        logger.error("Failed to sync booking to Fortnox", error as Error, {
          bookingId: booking.id,
        })
        failed++
      }
    }

    logger.info("Fortnox sync completed", {
      providerId,
      synced,
      failed,
      total: unsyncedBookings.length,
    })

    return NextResponse.json({
      synced,
      failed,
      total: unsyncedBookings.length,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Fortnox sync failed", error as Error)
    return NextResponse.json(
      { error: "Kunde inte synka fakturor" },
      { status: 500 }
    )
  }
}
