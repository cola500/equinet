import { IRepository } from '../BaseRepository'

export interface Conversation {
  id: string
  bookingId: string
  createdAt: Date
  lastMessageAt: Date
}

export interface Message {
  id: string
  conversationId: string
  senderType: 'CUSTOMER' | 'PROVIDER'
  senderId: string
  content: string
  createdAt: Date
  readAt: Date | null
}

export interface CreateMessageData {
  bookingId: string
  senderType: 'CUSTOMER' | 'PROVIDER'
  senderId: string
  content: string
}

export interface ListMessagesResult {
  messages: Message[]
  nextCursor: string | null
}

export interface IConversationRepository extends IRepository<Conversation> {
  /**
   * Find conversation for a booking (returns null if none exists yet)
   */
  findByBookingId(bookingId: string): Promise<Conversation | null>

  /**
   * Create message + upsert Conversation in a single transaction.
   * Updates lastMessageAt on the Conversation.
   */
  createMessage(data: CreateMessageData): Promise<Message>

  /**
   * List messages in a conversation (cursor-paginated, newest first).
   */
  listMessages(
    conversationId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<ListMessagesResult>

  /**
   * Mark all messages from the other party as read (readAt = now).
   * readerRole: the role of the person opening the thread.
   */
  markMessagesAsRead(
    conversationId: string,
    readerRole: 'CUSTOMER' | 'PROVIDER'
  ): Promise<void>

  /**
   * Count unread messages in a conversation for a given reader role.
   */
  getUnreadCount(
    conversationId: string,
    readerRole: 'CUSTOMER' | 'PROVIDER'
  ): Promise<number>
}
