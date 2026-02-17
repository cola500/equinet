/**
 * Email module exports
 */

export { emailService, sendEmailVerificationNotification } from "./email-service"
export {
  emailVerificationEmail,
  bookingConfirmationEmail,
  paymentConfirmationEmail,
  bookingStatusChangeEmail,
  rebookingReminderEmail,
  bookingReminderEmail,
} from "./templates"
export {
  sendBookingConfirmationNotification,
  sendPaymentConfirmationNotification,
  sendBookingStatusChangeNotification,
  sendRebookingReminderNotification,
  sendBookingReminderNotification,
} from "./notifications"
export {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  generateUnsubscribeUrl,
} from "./unsubscribe-token"
