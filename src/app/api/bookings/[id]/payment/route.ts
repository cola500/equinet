import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireAuth } from "@/lib/roles"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createPaymentService, mapPaymentErrorToStatus, mapPaymentErrorToMessage } from "@/domain/payment"
import { sendBookingConfirmationNotification, sendBookingStatusChangeNotification, sendPaymentConfirmationNotification } from "@/lib/email"
import { notificationService } from "@/domain/notification/NotificationService"
import { pushDeliveryService } from "@/domain/notification/PushDeliveryService"
import { createBookingEventDispatcher, createBookingPaymentReceivedEvent } from "@/domain/booking"

// POST - Process payment for a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const { userId } = requireAuth(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("stripe_payments"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    // Delegate to PaymentService
    const paymentService = createPaymentService()
    const result = await paymentService.processPayment(bookingId, userId)

    if (result.isFailure) {
      return NextResponse.json(
        { error: mapPaymentErrorToMessage(result.error) },
        { status: mapPaymentErrorToStatus(result.error) }
      )
    }

    const { payment, eventData, clientSecret } = result.value

    // Only dispatch event if payment completed immediately (mock gateway)
    // For async payments (Stripe), the webhook handles completion
    if (payment.status === "succeeded") {
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

      await dispatcher.dispatch(createBookingPaymentReceivedEvent(eventData))
    }

    return NextResponse.json({
      success: true,
      message: payment.status === "succeeded"
        ? "Betalning genomförd"
        : "Betalning initierad",
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt,
        invoiceNumber: payment.invoiceNumber,
      },
      ...(clientSecret && { clientSecret }),
    })
  } catch (error) {
    if (error instanceof Response) return error

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
    const { userId } = requireAuth(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    // Delegate to PaymentService
    const paymentService = createPaymentService()
    const result = await paymentService.getPaymentStatus(bookingId, userId)

    if (result.isFailure) {
      return NextResponse.json(
        { error: mapPaymentErrorToMessage(result.error) },
        { status: mapPaymentErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error fetching payment", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta betalningsstatus" },
      { status: 500 }
    )
  }
}
