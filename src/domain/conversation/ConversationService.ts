import { Result } from '@/domain/shared'
import type { IConversationRepository, Message, ListMessagesResult, InboxItem } from '@/infrastructure/persistence/conversation/IConversationRepository'

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
}

export interface ConversationServiceDeps {
  conversationRepository: IConversationRepository
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

  constructor(deps: ConversationServiceDeps) {
    this.repo = deps.conversationRepository
  }

  async sendMessage(input: SendMessageInput): Promise<Result<Message, ConversationError>> {
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

    return Result.ok(message)
  }

  async listMessages(input: ListMessagesInput): Promise<ListMessagesResult> {
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
    const conversation = await this.repo.findByBookingId(input.bookingId)
    if (!conversation) return
    await this.repo.markMessagesAsRead(conversation.id, input.readerRole)
  }

  async getInboxForProvider(providerUserId: string): Promise<InboxItem[]> {
    return this.repo.getInboxForProvider(providerUserId)
  }

  async getTotalUnreadForProvider(providerUserId: string): Promise<number> {
    return this.repo.getTotalUnreadForProvider(providerUserId)
  }
}
