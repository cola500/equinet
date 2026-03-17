import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { sendBookingConfirmationNotification, sendBookingStatusChangeNotification, sendPaymentConfirmationNotification } from "@/lib/email"
import { logger } from "@/lib/logger"
import { notificationService } from "@/domain/notification/NotificationService"
import { pushDeliveryService } from "@/domain/notification/PushDeliveryService"
import { customerName } from "@/lib/notification-helpers"
import { getPaymentGateway } from "@/domain/payment/PaymentGateway"
import { createBookingEventDispatcher, createBookingPaymentReceivedEvent } from "@/domain/booking"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { generateInvoiceNumber } from "@/domain/payment/InvoiceNumberGenerator"

// POST - Create mock payment for a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    // Verify booking belongs to customer and is in correct status
    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
        customerId: session.user.id
      },
      select: {
        id: true,
        status: true,
        providerId: true,
        bookingDate: true,
        service: {
          select: {
            price: true,
            name: true,
          }
        },
        payment: {
          select: {
            status: true,
          }
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        provider: {
          select: {
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokning hittades inte" },
        { status: 404 }
      )
    }

    // Check if already paid
    if (booking.payment?.status === "succeeded") {
      return NextResponse.json(
        { error: "Bokningen är redan betald" },
        { status: 400 }
      )
    }

    // Check booking status - only allow payment for confirmed or completed bookings
    if (!["confirmed", "completed"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Bokningen måste vara bekräftad innan betalning kan göras" },
        { status: 400 }
      )
    }

    // Process payment through gateway
    const gateway = getPaymentGateway()
    const paymentResult = await gateway.initiatePayment({
      bookingId: booking.id,
      amount: booking.service.price,
      currency: "SEK",
      description: booking.service.name,
    })

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || "Betalningen misslyckades" },
        { status: 402 }
      )
    }

    // Generate receipt URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const receiptUrl = `${baseUrl}/api/bookings/${booking.id}/receipt`

    // Create or update payment record
    const payment = await prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        amount: booking.service.price,
        currency: "SEK",
        provider: "mock",
        providerPaymentId: paymentResult.providerPaymentId,
        status: paymentResult.status,
        paidAt: paymentResult.paidAt,
        invoiceNumber: generateInvoiceNumber(),
        invoiceUrl: receiptUrl,
      },
      update: {
        providerPaymentId: paymentResult.providerPaymentId,
        status: paymentResult.status,
        paidAt: paymentResult.paidAt,
        invoiceNumber: generateInvoiceNumber(),
        invoiceUrl: receiptUrl,
      },
    })

    // Dispatch domain event for side-effects (email, notification)
    const dispatcher = createBookingEventDispatcher({
      emailService: {
        sendBookingConfirmation: sendBookingConfirmationNotification,
        sendBookingStatusChange: sendBookingStatusChangeNotification,
        sendPaymentConfirmation: sendPaymentConfirmationNotification,
      },
      notificationService,
      logger,
      pushService: pushDeliveryService,
    })

    const cName = booking.customer
      ? customerName(booking.customer.firstName, booking.customer.lastName)
      : "Kund"

    await dispatcher.dispatch(createBookingPaymentReceivedEvent({
      bookingId: booking.id,
      customerId: session.user.id,
      providerId: booking.providerId,
      providerUserId: booking.provider.userId,
      customerName: cName,
      serviceName: booking.service.name,
      bookingDate: booking.bookingDate instanceof Date
        ? booking.bookingDate.toISOString()
        : String(booking.bookingDate),
      amount: payment.amount,
      currency: payment.currency,
      paymentId: payment.id,
    }))

    return NextResponse.json({
      success: true,
      message: "Betalning genomförd",
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt,
        invoiceNumber: payment.invoiceNumber,
      }
    })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error processing payment", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte genomföra betalningen" },
      { status: 500 }
    )
  }
}

// GET - Get payment status for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    // Verify booking belongs to customer or provider
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [
          { customerId: session.user.id },
          { provider: { userId: session.user.id } }
        ]
      },
      select: {
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            invoiceNumber: true,
            invoiceUrl: true,
          }
        },
        service: {
          select: {
            price: true,
          }
        },
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokning hittades inte" },
        { status: 404 }
      )
    }

    if (!booking.payment) {
      return NextResponse.json({
        status: "unpaid",
        amount: booking.service.price,
        currency: "SEK",
      })
    }

    return NextResponse.json({
      id: booking.payment.id,
      status: booking.payment.status,
      amount: booking.payment.amount,
      currency: booking.payment.currency,
      paidAt: booking.payment.paidAt,
      invoiceNumber: booking.payment.invoiceNumber,
      invoiceUrl: booking.payment.invoiceUrl,
    })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching payment", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta betalningsstatus" },
      { status: 500 }
    )
  }
}
