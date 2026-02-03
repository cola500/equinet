import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export const NotificationType = {
  BOOKING_CREATED: "booking_created",
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  BOOKING_COMPLETED: "booking_completed",
  PAYMENT_RECEIVED: "payment_received",
  REVIEW_RECEIVED: "review_received",
  REMINDER_REBOOK: "reminder_rebook",
  GROUP_BOOKING_JOINED: "group_booking_joined",
  GROUP_BOOKING_LEFT: "group_booking_left",
  GROUP_BOOKING_MATCHED: "group_booking_matched",
  GROUP_BOOKING_CANCELLED: "group_booking_cancelled",
} as const

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType]

export interface CreateNotificationInput {
  userId: string
  type: NotificationTypeValue
  message: string
  linkUrl?: string
  metadata?: Record<string, string>
}

export class NotificationService {
  async create(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        linkUrl: input.linkUrl,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    })
  }

  async getForUser(userId: string, options?: { limit?: number }) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 20,
      select: {
        id: true,
        type: true,
        message: true,
        isRead: true,
        linkUrl: true,
        createdAt: true,
      },
    })
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    })
  }

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    })
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  }

  /**
   * Create notification without blocking the caller.
   * Logs errors but doesn't throw.
   */
  async createAsync(input: CreateNotificationInput): Promise<void> {
    try {
      await this.create(input)
    } catch (error) {
      logger.error(
        "Failed to create notification",
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }
}

// Singleton for use in API routes
export const notificationService = new NotificationService()
