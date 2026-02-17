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
  bookingRescheduleEmail,
} from "./templates"
export {
  sendBookingConfirmationNotification,
  sendPaymentConfirmationNotification,
  sendBookingStatusChangeNotification,
  sendRebookingReminderNotification,
  sendBookingReminderNotification,
  sendBookingRescheduleNotification,
} from "./notifications"
export {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  generateUnsubscribeUrl,
} from "./unsubscribe-token"
