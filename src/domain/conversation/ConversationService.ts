import { Result } from '@/domain/shared'
import { logger } from '@/lib/logger'
import type { IConversationRepository, Message, ListMessagesResult, InboxItem } from '@/infrastructure/persistence/conversation/IConversationRepository'
import type { MessageNotifier, NotifyNewMessageInput } from '@/domain/notification/MessageNotifier'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface BookingForConversation {
  id: string
  customerId: string
  providerId: string
  providerUserId: string
  status: string
  bookingDate: Date
  customerName: string
  providerName: string
  serviceName: string
}

export interface ConversationServiceDeps {
  conversationRepository: IConversationRepository
  isFeatureEnabled: (key: string) => Promise<boolean>
  messageNotifier?: MessageNotifier
}

export interface SendMessageInput {
  booking: BookingForConversation
  senderType: 'CUSTOMER' | 'PROVIDER'
  senderId: string
  content: string
}

export interface ListMessagesInput {
  bookingId: string
  cursor?: string
  limit?: number
}

export interface MarkAsReadInput {
  bookingId: string
  readerRole: 'CUSTOMER' | 'PROVIDER'
}

export type ConversationErrorType =
  | 'BOOKING_CLOSED'
  | 'CONTENT_EMPTY'
  | 'CONTENT_TOO_LONG'
  | 'FEATURE_DISABLED'

export interface ConversationError {
  type: ConversationErrorType
  message: string
}

const CLOSED_STATUSES = ['cancelled', 'no_show']
const COMPLETED_WINDOW_DAYS = 30

function isMessagingAllowed(booking: BookingForConversation): boolean {
  if (CLOSED_STATUSES.includes(booking.status)) return false
  if (booking.status === 'completed') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - COMPLETED_WINDOW_DAYS)
    return booking.bookingDate >= cutoff
  }
  return true
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class ConversationService {
  private readonly repo: IConversationRepository
  private readonly isFeatureEnabled: (key: string) => Promise<boolean>
  private readonly messageNotifier?: MessageNotifier

  constructor(deps: ConversationServiceDeps) {
    this.repo = deps.conversationRepository
    this.isFeatureEnabled = deps.isFeatureEnabled
    this.messageNotifier = deps.messageNotifier
  }

  async sendMessage(input: SendMessageInput): Promise<Result<Message, ConversationError>> {
    // 0. Feature flag gate
    if (!(await this.isFeatureEnabled('messaging'))) {
      return Result.fail({ type: 'FEATURE_DISABLED', message: 'Ej tillgänglig' })
    }

    // 1. Status gating
    if (!isMessagingAllowed(input.booking)) {
      return Result.fail({
        type: 'BOOKING_CLOSED',
        message: 'Cannot send message to closed booking',
      })
    }

    // 2. Content validation
    const trimmed = input.content.trim()
    if (trimmed.length === 0) {
      return Result.fail({ type: 'CONTENT_EMPTY', message: 'Content cannot be empty' })
    }
    if (trimmed.length > 2000) {
      return Result.fail({ type: 'CONTENT_TOO_LONG', message: 'Content exceeds 2000 characters' })
    }

    // 3. Persist message (lazy conversation creation in repo)
    const message = await this.repo.createMessage({
      bookingId: input.booking.id,
      senderType: input.senderType,
      senderId: input.senderId,
      content: trimmed,
    })

    // 4. Fire-and-forget push notification
    this.sendMessageNotification(input, message)

    return Result.ok(message)
  }

  private sendMessageNotification(input: SendMessageInput, message: Message): void {
    if (!this.messageNotifier) return

    const isCustomerSender = input.senderType === 'CUSTOMER'
    const notifyInput: NotifyNewMessageInput = {
      bookingId: input.booking.id,
      senderType: input.senderType,
      senderName: isCustomerSender ? input.booking.customerName : input.booking.providerName,
      recipientUserId: isCustomerSender ? input.booking.providerUserId : input.booking.customerId,
      recipientRole: isCustomerSender ? 'PROVIDER' : 'CUSTOMER',
      contentPreview: message.content,
      deepLink: isCustomerSender
        ? `/provider/messages/${input.booking.id}`
        : `/customer/bookings/${input.booking.id}`,
    }

    void this.messageNotifier
      .notifyNewMessage(notifyInput)
      .catch((err) =>
        logger.error('ConversationService: notification failed', {
          bookingId: input.booking.id,
          err: err instanceof Error ? err.message : String(err),
        })
      )
  }

  async listMessages(input: ListMessagesInput): Promise<ListMessagesResult> {
    if (!(await this.isFeatureEnabled('messaging'))) {
      return { messages: [], nextCursor: null }
    }
    const conversation = await this.repo.findByBookingId(input.bookingId)
    if (!conversation) {
      return { messages: [], nextCursor: null }
    }
    return this.repo.listMessages(conversation.id, {
      cursor: input.cursor,
      limit: input.limit,
    })
  }

  async markAsRead(input: MarkAsReadInput): Promise<void> {
    if (!(await this.isFeatureEnabled('messaging'))) return
    const conversation = await this.repo.findByBookingId(input.bookingId)
    if (!conversation) return
    await this.repo.markMessagesAsRead(conversation.id, input.readerRole)
  }

  async getInboxForProvider(providerUserId: string): Promise<InboxItem[]> {
    if (!(await this.isFeatureEnabled('messaging'))) return []
    return this.repo.getInboxForProvider(providerUserId)
  }

  async getTotalUnreadForProvider(providerUserId: string): Promise<number> {
    if (!(await this.isFeatureEnabled('messaging'))) return 0
    return this.repo.getTotalUnreadForProvider(providerUserId)
  }
}
