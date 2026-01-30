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
} from "./templates"
export {
  sendBookingConfirmationNotification,
  sendPaymentConfirmationNotification,
  sendBookingStatusChangeNotification,
  sendRebookingReminderNotification,
} from "./notifications"
