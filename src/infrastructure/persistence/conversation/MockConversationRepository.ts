import type {
  IConversationRepository,
  Conversation,
  Message,
  CreateMessageData,
  ListMessagesResult,
} from './IConversationRepository'

export class MockConversationRepository implements IConversationRepository {
  private conversations: Map<string, Conversation> = new Map()
  private messages: Map<string, Message> = new Map()

  async findById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null
  }

  async findMany(): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
  }

  async save(entity: Conversation): Promise<Conversation> {
    this.conversations.set(entity.id, entity)
    return entity
  }

  async delete(id: string): Promise<void> {
    this.conversations.delete(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.conversations.has(id)
  }

  async findByBookingId(bookingId: string): Promise<Conversation | null> {
    for (const c of this.conversations.values()) {
      if (c.bookingId === bookingId) return c
    }
    return null
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    const now = new Date()

    // Upsert conversation
    let conversation = await this.findByBookingId(data.bookingId)
    if (!conversation) {
      conversation = {
        id: `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        bookingId: data.bookingId,
        createdAt: now,
        lastMessageAt: now,
      }
      this.conversations.set(conversation.id, conversation)
    } else {
      conversation.lastMessageAt = now
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: conversation.id,
      senderType: data.senderType,
      senderId: data.senderId,
      content: data.content,
      createdAt: now,
      readAt: null,
    }
    this.messages.set(message.id, message)
    return message
  }

  async listMessages(
    conversationId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<ListMessagesResult> {
    const limit = options?.limit ?? 50
    let msgs = Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    if (options?.cursor) {
      const cursorIndex = msgs.findIndex((m) => m.id === options.cursor)
      if (cursorIndex !== -1) {
        msgs = msgs.slice(cursorIndex + 1)
      }
    }

    const page = msgs.slice(0, limit)
    return {
      messages: page,
      nextCursor: msgs.length > limit ? msgs[limit - 1].id : null,
    }
  }

  async markMessagesAsRead(
    conversationId: string,
    readerRole: 'CUSTOMER' | 'PROVIDER'
  ): Promise<void> {
    const senderToMark: 'CUSTOMER' | 'PROVIDER' =
      readerRole === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER'
    const now = new Date()
    for (const msg of this.messages.values()) {
      if (
        msg.conversationId === conversationId &&
        msg.senderType === senderToMark &&
        msg.readAt === null
      ) {
        msg.readAt = now
      }
    }
  }

  async getUnreadCount(
    conversationId: string,
    readerRole: 'CUSTOMER' | 'PROVIDER'
  ): Promise<number> {
    const senderToCount: 'CUSTOMER' | 'PROVIDER' =
      readerRole === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER'
    let count = 0
    for (const msg of this.messages.values()) {
      if (
        msg.conversationId === conversationId &&
        msg.senderType === senderToCount &&
        msg.readAt === null
      ) {
        count++
      }
    }
    return count
  }

  // Test helpers
  clear(): void {
    this.conversations.clear()
    this.messages.clear()
  }

  seedConversation(conversation: Conversation): void {
    this.conversations.set(conversation.id, conversation)
  }

  seedMessage(message: Message): void {
    this.messages.set(message.id, message)
  }

  getMessages(): Message[] {
    return Array.from(this.messages.values())
  }
}
