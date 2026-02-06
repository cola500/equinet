import { prisma } from "@/lib/prisma"
import {
  notificationService,
  NotificationType,
} from "@/domain/notification/NotificationService"
import { sendRebookingReminderNotification } from "@/lib/email"
import { logger } from "@/lib/logger"

export interface DueReminder {
  bookingId: string
  customerId: string
  providerId: string
  serviceId: string
  serviceName: string
  providerName: string
}

export class ReminderService {
  /**
   * Find completed bookings that are due for rebooking reminders.
   *
   * A booking is due when:
   * 1. The service has recommendedIntervalWeeks set
   * 2. Enough time has passed since the booking was completed
   * 3. No reminder notification has been sent for this booking yet
   */
  async findDueReminders(today: Date = new Date()): Promise<DueReminder[]> {
    // Find all completed bookings with services that have interval set
    const completedBookings = await prisma.booking.findMany({
      where: {
        status: "completed",
        service: {
          recommendedIntervalWeeks: { not: null },
        },
      },
      select: {
        id: true,
        customerId: true,
        providerId: true,
        horseId: true,
        updatedAt: true,
        service: {
          select: {
            id: true,
            name: true,
            recommendedIntervalWeeks: true,
          },
        },
        provider: {
          select: {
            businessName: true,
          },
        },
      },
    })

    const dueReminders: DueReminder[] = []

    for (const booking of completedBookings) {
      const serviceInterval = booking.service.recommendedIntervalWeeks
      if (!serviceInterval) continue

      // Check for horse-specific override (only if booking has a horse)
      let intervalWeeks = serviceInterval
      if (booking.horseId) {
        const horseOverride = await prisma.horseServiceInterval.findUnique({
          where: {
            horseId_providerId: {
              horseId: booking.horseId,
              providerId: booking.providerId,
            },
          },
          select: { revisitIntervalWeeks: true },
        })
        if (horseOverride) {
          intervalWeeks = horseOverride.revisitIntervalWeeks
        }
      }

      // Check if enough time has passed
      const dueDate = new Date(booking.updatedAt)
      dueDate.setDate(dueDate.getDate() + intervalWeeks * 7)

      if (today < dueDate) continue // Not yet due

      // Check if a reminder has already been sent for this booking
      const existingReminder = await prisma.notification.count({
        where: {
          userId: booking.customerId,
          type: NotificationType.REMINDER_REBOOK,
          metadata: {
            contains: booking.id,
          },
        },
      })

      if (existingReminder > 0) continue // Already reminded

      dueReminders.push({
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        serviceId: booking.service.id,
        serviceName: booking.service.name,
        providerName: booking.provider.businessName,
      })
    }

    return dueReminders
  }

  /**
   * Send a rebooking reminder: in-app notification + email
   */
  async sendReminder(reminder: DueReminder): Promise<void> {
    // 1. Create in-app notification
    await notificationService.create({
      userId: reminder.customerId,
      type: NotificationType.REMINDER_REBOOK,
      message: `Dags att boka ${reminder.serviceName} hos ${reminder.providerName} igen!`,
      linkUrl: `/providers/${reminder.providerId}`,
      metadata: {
        bookingId: reminder.bookingId,
        providerId: reminder.providerId,
        serviceId: reminder.serviceId,
      },
    })

    // 2. Send email
    await sendRebookingReminderNotification(reminder.customerId, {
      serviceName: reminder.serviceName,
      providerName: reminder.providerName,
      providerId: reminder.providerId,
      serviceId: reminder.serviceId,
    })
  }

  /**
   * Process all due reminders.
   * Returns the number of reminders sent.
   */
  async processAll(today?: Date): Promise<number> {
    const dueReminders = await this.findDueReminders(today)

    let sentCount = 0
    for (const reminder of dueReminders) {
      try {
        await this.sendReminder(reminder)
        sentCount++
      } catch (error) {
        logger.error(
          `Failed to send reminder for booking ${reminder.bookingId}`,
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }

    return sentCount
  }
}
