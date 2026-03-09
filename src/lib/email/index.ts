/**
 * Email module exports
 */

export { emailService, sendEmailVerificationNotification, sendPasswordResetNotification, sendAccountDeletionNotification, sendCustomerInviteNotification, sendStableInviteNotification } from "./email-service"
export {
  emailVerificationEmail,
  passwordResetEmail,
  bookingConfirmationEmail,
  paymentConfirmationEmail,
  bookingStatusChangeEmail,
  rebookingReminderEmail,
  bookingReminderEmail,
  bookingRescheduleEmail,
  accountDeletionConfirmationEmail,
  customerInviteEmail,
  stableInviteEmail,
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
