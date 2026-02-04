/**
 * Notification Service - High-level service for sending notifications
 *
 * Coordinates email sending with proper data formatting.
 */

import { prisma } from "@/lib/prisma"
import { emailService } from "./email-service"
import {
  bookingConfirmationEmail,
  paymentConfirmationEmail,
  bookingStatusChangeEmail,
  rebookingReminderEmail,
} from "./templates"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

const statusLabels: Record<string, string> = {
  pending: "Väntar på bekräftelse",
  confirmed: "Bekräftad",
  cancelled: "Avbokad",
  completed: "Genomförd",
}

export async function sendBookingConfirmationNotification(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        service: {
          select: {
            name: true,
            price: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    if (!booking || !booking.customer.email) {
      console.warn(`Cannot send booking confirmation: booking ${bookingId} not found or no email`)
      return { success: false, error: "Booking not found or no email" }
    }

    // Skip email for ghost users (manual bookings with sentinel email)
    if (booking.customer.email.endsWith('@ghost.equinet.se')) {
      return { success: true, error: undefined }
    }

    const { html, text } = bookingConfirmationEmail({
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      serviceName: booking.service.name,
      providerName: `${booking.provider.user.firstName} ${booking.provider.user.lastName}`,
      businessName: booking.provider.businessName,
      bookingDate: format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv }),
      startTime: booking.startTime,
      endTime: booking.endTime,
      price: booking.service.price,
      bookingId: booking.id,
    })

    return await emailService.send({
      to: booking.customer.email,
      subject: `Bokningsbekräftelse - ${booking.service.name}`,
      html,
      text,
    })
  } catch (error) {
    console.error("Error sending booking confirmation:", error)
    return { success: false, error: String(error) }
  }
}

export async function sendPaymentConfirmationNotification(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        payment: true,
      },
    })

    if (!booking || !booking.customer.email || !booking.payment) {
      console.warn(`Cannot send payment confirmation: booking ${bookingId} not found, no email, or no payment`)
      return { success: false, error: "Booking, email, or payment not found" }
    }

    const { html, text } = paymentConfirmationEmail({
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      serviceName: booking.service.name,
      providerName: `${booking.provider.user.firstName} ${booking.provider.user.lastName}`,
      businessName: booking.provider.businessName,
      bookingDate: format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv }),
      amount: booking.payment.amount,
      currency: booking.payment.currency,
      invoiceNumber: booking.payment.invoiceNumber || "N/A",
      paidAt: booking.payment.paidAt
        ? format(new Date(booking.payment.paidAt), "d MMMM yyyy HH:mm", { locale: sv })
        : "N/A",
      bookingId: booking.id,
    })

    return await emailService.send({
      to: booking.customer.email,
      subject: `Betalningsbekräftelse - ${booking.payment.invoiceNumber}`,
      html,
      text,
    })
  } catch (error) {
    console.error("Error sending payment confirmation:", error)
    return { success: false, error: String(error) }
  }
}

export async function sendBookingStatusChangeNotification(
  bookingId: string,
  newStatus: string,
  cancellationMessage?: string
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    if (!booking || !booking.customer.email) {
      console.warn(`Cannot send status change notification: booking ${bookingId} not found or no email`)
      return { success: false, error: "Booking not found or no email" }
    }

    // Skip email for ghost users (manual bookings with sentinel email)
    if (booking.customer.email.endsWith('@ghost.equinet.se')) {
      return { success: true, error: undefined }
    }

    const { html, text } = bookingStatusChangeEmail({
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      serviceName: booking.service.name,
      providerName: `${booking.provider.user.firstName} ${booking.provider.user.lastName}`,
      businessName: booking.provider.businessName,
      bookingDate: format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv }),
      startTime: `${booking.startTime} - ${booking.endTime}`,
      newStatus,
      statusLabel: statusLabels[newStatus] || newStatus,
      cancellationMessage,
    })

    return await emailService.send({
      to: booking.customer.email,
      subject: `Bokningsuppdatering - ${statusLabels[newStatus] || newStatus}`,
      html,
      text,
    })
  } catch (error) {
    console.error("Error sending status change notification:", error)
    return { success: false, error: String(error) }
  }
}

export async function sendRebookingReminderNotification(
  customerId: string,
  data: {
    serviceName: string
    providerName: string
    providerId: string
    serviceId: string
  }
) {
  try {
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    })

    if (!customer || !customer.email) {
      console.warn(`Cannot send rebooking reminder: customer ${customerId} not found or no email`)
      return { success: false, error: "Customer not found or no email" }
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const rebookUrl = `${baseUrl}/providers/${data.providerId}`

    const { html, text } = rebookingReminderEmail({
      customerName: `${customer.firstName} ${customer.lastName}`,
      serviceName: data.serviceName,
      providerName: data.providerName,
      rebookUrl,
    })

    return await emailService.send({
      to: customer.email,
      subject: `Dags att boka ${data.serviceName} igen!`,
      html,
      text,
    })
  } catch (error) {
    console.error("Error sending rebooking reminder:", error)
    return { success: false, error: String(error) }
  }
}
