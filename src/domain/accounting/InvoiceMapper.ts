/**
 * InvoiceMapper - Maps booking data to invoice data for accounting systems
 */

import { InvoiceData } from "./AccountingGateway"

export interface BookingForInvoice {
  id: string
  bookingDate: Date | string
  customer: {
    firstName: string
    lastName: string
    email: string
  }
  provider: {
    businessName: string
  }
  service: {
    name: string
    price: number
  }
  payment?: {
    amount: number
    currency: string
  } | null
}

/**
 * Map a booking with relations to InvoiceData for the accounting gateway.
 */
export function mapBookingToInvoice(booking: BookingForInvoice): InvoiceData {
  const bookingDate =
    booking.bookingDate instanceof Date
      ? booking.bookingDate.toISOString().split("T")[0]
      : String(booking.bookingDate).split("T")[0]

  return {
    bookingId: booking.id,
    customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
    customerEmail: booking.customer.email,
    providerName: booking.provider.businessName,
    serviceName: booking.service.name,
    amount: booking.payment?.amount ?? booking.service.price,
    currency: booking.payment?.currency ?? "SEK",
    bookingDate,
    description: `${booking.service.name} - ${bookingDate}`,
  }
}
