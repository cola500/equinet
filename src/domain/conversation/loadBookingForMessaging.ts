import { prisma } from '@/lib/prisma'
import type { BookingForConversation } from './ConversationService'

export async function loadBookingForMessaging(
  bookingId: string,
  userId: string,
  userType: 'customer' | 'provider'
): Promise<BookingForConversation | null> {
  const row = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      ...(userType === 'customer'
        ? { customerId: userId }
        : { provider: { userId } }),
    },
    select: {
      id: true,
      customerId: true,
      providerId: true,
      status: true,
      bookingDate: true,
      provider: {
        select: {
          id: true,
          businessName: true,
          user: { select: { id: true } },
        },
      },
      customer: { select: { firstName: true, lastName: true } },
    },
  })

  if (!row) return null

  return {
    id: row.id,
    customerId: row.customerId,
    providerId: row.providerId,
    providerUserId: row.provider.user.id,
    status: row.status,
    bookingDate: row.bookingDate,
    customerName: `${row.customer.firstName} ${row.customer.lastName}`,
    providerName: row.provider.businessName,
  }
}
