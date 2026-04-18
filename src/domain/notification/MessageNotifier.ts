import { logger } from '@/lib/logger'
import { NotificationType } from './NotificationService'
import type { CreateNotificationInput } from './NotificationService'
import type { PushPayload } from './PushDeliveryService'

interface NotificationServiceDep {
  createAsync: (input: CreateNotificationInput) => Promise<void>
}

interface PushDeliveryServiceDep {
  sendToUser: (userId: string, payload: PushPayload) => Promise<void>
}

interface MessageNotifierDeps {
  notificationService: NotificationServiceDep
  pushDeliveryService: PushDeliveryServiceDep
}

export interface NotifyNewMessageInput {
  bookingId: string
  senderType: 'CUSTOMER' | 'PROVIDER'
  senderName: string
  recipientUserId: string
  recipientRole: 'CUSTOMER' | 'PROVIDER'
  contentPreview: string
  deepLink: string
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

export class MessageNotifier {
  private readonly notificationService: NotificationServiceDep
  private readonly pushDeliveryService: PushDeliveryServiceDep

  constructor(deps: MessageNotifierDeps) {
    this.notificationService = deps.notificationService
    this.pushDeliveryService = deps.pushDeliveryService
  }

  async notifyNewMessage(input: NotifyNewMessageInput): Promise<void> {
    const { bookingId, senderName, recipientUserId, contentPreview, deepLink } = input

    try {
      await this.notificationService.createAsync({
        userId: recipientUserId,
        type: NotificationType.MESSAGE_RECEIVED,
        message: `Nytt meddelande från ${senderName}`,
        linkUrl: deepLink,
        metadata: { bookingId },
      })
    } catch (err) {
      logger.error('MessageNotifier: in-app notification failed', {
        bookingId,
        recipientUserId,
        err: err instanceof Error ? err.message : String(err),
      })
    }

    try {
      await this.pushDeliveryService.sendToUser(recipientUserId, {
        title: `Nytt meddelande från ${senderName}`,
        body: truncate(contentPreview, 80),
        url: deepLink,
        category: 'MESSAGE',
        bookingId,
      })
    } catch (err) {
      logger.error('MessageNotifier: push notification failed', {
        bookingId,
        recipientUserId,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
