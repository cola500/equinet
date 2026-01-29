/**
 * Email module exports
 */

export { emailService, sendEmailVerificationNotification } from "./email-service"
export {
  emailVerificationEmail,
  bookingConfirmationEmail,
  paymentConfirmationEmail,
  bookingStatusChangeEmail,
} from "./templates"
export {
  sendBookingConfirmationNotification,
  sendPaymentConfirmationNotification,
  sendBookingStatusChangeNotification,
} from "./notifications"
