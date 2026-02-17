import { prisma } from "@/lib/prisma"
import {
  notificationService,
  NotificationType,
} from "@/domain/notification/NotificationService"
import { sendBookingReminderNotification } from "@/lib/email"
import { logger } from "@/lib/logger"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

export interface BookingReminder {
  bookingId: string
  customerId: string
  customerEmail: string
  providerId: string
  serviceName: string
  providerName: string
  bookingDate: string
  startTime: string
  endTime: string
}

export class BookingReminderService {
  /**
   * Find confirmed bookings that are due for a 24h reminder.
   *
   * Uses a 22-30h window to compensate for cron timing variance.
   * Deduplicates via the Notification table.
   */
  async findDueReminders(now: Date = new Date()): Promise<BookingReminder[]> {
    // Calculate the date window: bookings happening 22-30h from now
    const minTime = new Date(now.getTime() + 22 * 60 * 60 * 1000)
    const maxTime = new Date(now.getTime() + 30 * 60 * 60 * 1000)

    // Query confirmed bookings within the date range
    // We use a wider date range and filter precisely in code
    const minDate = new Date(minTime.toISOString().split("T")[0] + "T00:00:00.000Z")
    const maxDate = new Date(maxTime.toISOString().split("T")[0] + "T23:59:59.999Z")

    const bookings = await prisma.booking.findMany({
      where: {
        status: "confirmed",
        bookingDate: {
          gte: minDate,
          lte: maxDate,
        },
      },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        customerId: true,
        providerId: true,
        service: {
          select: { name: true },
        },
        provider: {
          select: {
            businessName: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        customer: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            emailRemindersEnabled: true,
          },
        },
      },
    })

    const reminders: BookingReminder[] = []

    for (const booking of bookings) {
      // Skip ghost users
      if (booking.customer.email.endsWith("@ghost.equinet.se")) continue

      // Skip customers who opted out
      if (!booking.customer.emailRemindersEnabled) continue

      // Combine bookingDate + startTime to get exact booking time
      const dateStr = booking.bookingDate.toISOString().split("T")[0]
      const bookingDateTime = new Date(`${dateStr}T${booking.startTime}:00.000Z`)

      // Check if within the 22-30h window
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil < 22 || hoursUntil > 30) continue

      // Deduplicate: skip if already reminded
      const existingReminder = await prisma.notification.count({
        where: {
          userId: booking.customerId,
          type: NotificationType.REMINDER_BOOKING_24H,
          metadata: { contains: booking.id },
        },
      })
      if (existingReminder > 0) continue

      reminders.push({
        bookingId: booking.id,
        customerId: booking.customerId,
        customerEmail: booking.customer.email,
        providerId: booking.providerId,
        serviceName: booking.service.name,
        providerName: booking.provider.businessName,
        bookingDate: format(booking.bookingDate, "d MMMM yyyy", { locale: sv }),
        startTime: booking.startTime,
        endTime: booking.endTime,
      })
    }

    return reminders
  }

  /**
   * Send a booking reminder: in-app notification + email
   */
  async sendReminder(reminder: BookingReminder): Promise<void> {
    // 1. Create in-app notification
    await notificationService.create({
      userId: reminder.customerId,
      type: NotificationType.REMINDER_BOOKING_24H,
      message: `Påminnelse: Du har en bokning för ${reminder.serviceName} hos ${reminder.providerName} imorgon kl ${reminder.startTime}`,
      linkUrl: "/customer/bookings",
      metadata: {
        bookingId: reminder.bookingId,
        providerId: reminder.providerId,
      },
    })

    // 2. Send email
    await sendBookingReminderNotification(reminder.bookingId)
  }

  /**
   * Process all due booking reminders.
   * Returns the number of reminders sent.
   */
  async processAll(now?: Date): Promise<number> {
    const dueReminders = await this.findDueReminders(now)

    let sentCount = 0
    for (const reminder of dueReminders) {
      try {
        await this.sendReminder(reminder)
        sentCount++
      } catch (error) {
        logger.error(
          `Failed to send booking reminder for booking ${reminder.bookingId}`,
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }

    return sentCount
  }
}
