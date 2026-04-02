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
    updatePaymentStatus: async (paymentId, data, guardNotInStatus) => {
      const result = await prisma.payment.updateMany({
        where: {
          id: paymentId,
          status: { notIn: guardNotInStatus },
        },
        data,
      })
      return result.count
    },
    generateInvoiceNumber,
    getBaseUrl: () => process.env.NEXTAUTH_URL || "http://localhost:3000",
  })
}
