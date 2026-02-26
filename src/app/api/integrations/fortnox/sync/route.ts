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

    const providerId = session.user.providerId
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
      select: {
        id: true,
        bookingDate: true,
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
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            fortnoxInvoiceId: true,
          },
        },
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

    // Process API calls with limited concurrency (max 3 simultaneous)
    const CONCURRENCY_LIMIT = 3
    const pendingUpdates: { paymentId: string; externalId: string; status: string }[] = []

    for (let i = 0; i < unsyncedBookings.length; i += CONCURRENCY_LIMIT) {
      const batch = unsyncedBookings.slice(i, i + CONCURRENCY_LIMIT)
      const results = await Promise.allSettled(
        batch.map(async (booking) => {
          const invoiceData = mapBookingToInvoice(booking)
          const result = await gateway.createInvoice(invoiceData)
          return { booking, result }
        })
      )

      for (const settled of results) {
        if (settled.status === "fulfilled") {
          const { booking, result } = settled.value
          if (result.success && booking.payment) {
            pendingUpdates.push({
              paymentId: booking.payment.id,
              externalId: result.externalId || "",
              status: result.status || "sent",
            })
            synced++
          } else {
            failed++
          }
        } else {
          logger.error("Failed to sync booking to Fortnox", settled.reason as Error)
          failed++
        }
      }
    }

    // Batch all DB updates in a single transaction
    if (pendingUpdates.length > 0) {
      // @ts-expect-error - Prisma transaction callback type inference issue
      await prisma.$transaction(async (tx: typeof prisma) => {
        for (const update of pendingUpdates) {
          await tx.payment.update({
            where: { id: update.paymentId },
            data: {
              fortnoxInvoiceId: update.externalId,
              fortnoxStatus: update.status,
              sentToFortnoxAt: new Date(),
            },
          })
        }
      })
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
