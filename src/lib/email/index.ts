/**
 * Email module exports
 */

export { emailService, sendEmailVerificationNotification, sendPasswordResetNotification } from "./email-service"
export {
  emailVerificationEmail,
  passwordResetEmail,
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
