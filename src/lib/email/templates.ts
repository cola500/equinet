/**
 * Email Templates - barrel file re-exporting all templates
 */

export { emailVerificationEmail } from "./templates/email-verification"
export { passwordResetEmail } from "./templates/password-reset"
export { bookingConfirmationEmail } from "./templates/booking-confirmation"
export { paymentConfirmationEmail } from "./templates/payment-confirmation"
export { bookingStatusChangeEmail } from "./templates/booking-status-change"
export { rebookingReminderEmail } from "./templates/rebooking-reminder"
export { bookingReminderEmail } from "./templates/booking-reminder"
export { bookingRescheduleEmail } from "./templates/booking-reschedule"
export { bookingSeriesCreatedEmail } from "./templates/booking-series-created"
export { accountDeletionConfirmationEmail } from "./templates/account-deletion"
export { customerInviteEmail } from "./templates/customer-invite"
export { stableInviteEmail } from "./templates/stable-invite"

export type { BookingSeriesCreatedData } from "./templates/booking-series-created"
