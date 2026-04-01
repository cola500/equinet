import { prisma } from "@/lib/prisma"
import { generateInvoiceNumber } from "./InvoiceNumberGenerator"
import { PaymentWebhookService } from "./PaymentWebhookService"

export function createPaymentWebhookService(): PaymentWebhookService {
  return new PaymentWebhookService({
    findPaymentByProviderPaymentId: async (providerPaymentId) => {
      return prisma.payment.findFirst({
        where: { providerPaymentId },
        select: {
          id: true,
          bookingId: true,
          status: true,
        },
      })
    },
    updatePaymentStatus: async (paymentId, data) => {
      await prisma.payment.update({
        where: { id: paymentId },
        data,
      })
    },
    generateInvoiceNumber,
    getBaseUrl: () => process.env.NEXTAUTH_URL || "http://localhost:3000",
  })
}
