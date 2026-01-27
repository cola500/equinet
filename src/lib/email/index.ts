/**
 * Email module exports
 */

export { emailService } from "./email-service"
export {
  bookingConfirmationEmail,
  paymentConfirmationEmail,
  bookingStatusChangeEmail,
} from "./templates"
export {
  sendBookingConfirmationNotification,
  sendPaymentConfirmationNotification,
  sendBookingStatusChangeNotification,
} from "./notifications"
