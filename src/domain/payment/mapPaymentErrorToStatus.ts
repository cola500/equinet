import type { PaymentError } from "./PaymentService"

/**
 * Map PaymentError to HTTP status code
 */
export function mapPaymentErrorToStatus(error: PaymentError): number {
  switch (error.type) {
    case "BOOKING_NOT_FOUND":
      return 404
    case "ALREADY_PAID":
    case "INVALID_STATUS":
      return 400
    case "GATEWAY_FAILED":
      return 402
    default:
      return 500
  }
}

/**
 * Map PaymentError to user-friendly message
 */
export function mapPaymentErrorToMessage(error: PaymentError): string {
  switch (error.type) {
    case "BOOKING_NOT_FOUND":
      return "Bokning hittades inte"
    case "ALREADY_PAID":
      return "Bokningen är redan betald"
    case "INVALID_STATUS":
      return "Bokningen måste vara bekräftad innan betalning kan göras"
    case "GATEWAY_FAILED":
      return error.message || "Betalningen misslyckades"
    default:
      return "Ett fel uppstod vid betalning"
  }
}
