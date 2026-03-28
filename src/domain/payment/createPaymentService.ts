import { prisma } from "@/lib/prisma"
import { getPaymentGateway } from "./PaymentGateway"
import { generateInvoiceNumber } from "./InvoiceNumberGenerator"
import { PaymentService } from "./PaymentService"

/**
 * Factory function for creating PaymentService with production dependencies.
 * Follows the same pattern as createBookingService().
 */
export function createPaymentService(): PaymentService {
  return new PaymentService({
    findBookingForPayment: async (bookingId, customerId) => {
      return prisma.booking.findUnique({
        where: { id: bookingId, customerId },
        select: {
          id: true,
          status: true,
          providerId: true,
          bookingDate: true,
          service: { select: { price: true, name: true } },
          payment: { select: { status: true } },
          customer: { select: { firstName: true, lastName: true } },
          provider: { select: { userId: true } },
        },
      })
    },
    findBookingForStatus: async (bookingId, userId) => {
      return prisma.booking.findFirst({
        where: {
          id: bookingId,
          OR: [
            { customerId: userId },
            { provider: { userId } },
          ],
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
            },
          },
          service: { select: { price: true } },
        },
      })
    },
    upsertPayment: async (data) => {
      return prisma.payment.upsert({
        where: { bookingId: data.bookingId },
        create: {
          bookingId: data.bookingId,
          amount: data.amount,
          currency: data.currency,
          provider: data.provider,
          providerPaymentId: data.providerPaymentId,
          status: data.status,
          paidAt: data.paidAt,
          invoiceNumber: data.invoiceNumber,
          invoiceUrl: data.invoiceUrl,
        },
        update: {
          providerPaymentId: data.providerPaymentId,
          status: data.status,
          paidAt: data.paidAt,
          invoiceNumber: data.invoiceNumber,
          invoiceUrl: data.invoiceUrl,
        },
      })
    },
    paymentGateway: getPaymentGateway(),
    generateInvoiceNumber,
    getBaseUrl: () => process.env.NEXTAUTH_URL || "http://localhost:3000",
  })
}
