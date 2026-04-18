import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IConversationRepository,
  Conversation,
  Message,
  CreateMessageData,
  ListMessagesResult,
  InboxItem,
} from './IConversationRepository'

const conversationSelect = {
  id: true,
  bookingId: true,
  createdAt: true,
  lastMessageAt: true,
} satisfies Prisma.ConversationSelect

const messageSelect = {
  id: true,
  conversationId: true,
  senderType: true,
  senderId: true,
  content: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.MessageSelect

export class PrismaConversationRepository implements IConversationRepository {
  async findById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({
      where: { id },
      select: conversationSelect,
    })
  }

  async findMany(): Promise<Conversation[]> {
    return prisma.conversation.findMany({ select: conversationSelect })
  }

  async save(entity: Conversation): Promise<Conversation> {
    const exists = await this.exists(entity.id)
    if (exists) {
      return (await this.findById(entity.id))!
    }
    return prisma.conversation.create({
      data: { id: entity.id, bookingId: entity.bookingId },
      select: conversationSelect,
    })
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.conversation.delete({ where: { id } })
    } catch {
      // Silently ignore if not found
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.conversation.count({ where: { id } })
    return count > 0
  }

  async findByBookingId(bookingId: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({
      where: { bookingId },
      select: conversationSelect,
    })
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    const now = new Date()

    const [, message] = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { bookingId: data.bookingId },
        create: { bookingId: data.bookingId, lastMessageAt: now },
        update: { lastMessageAt: now },
        select: { id: true },
      })

      const msg = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderType: data.senderType,
          senderId: data.senderId,
          content: data.content,
          createdAt: now,
        },
        select: messageSelect,
      })

      return [conversation, msg]
    })

    return message as Message
  }

  async listMessages(
    conversationId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<ListMessagesResult> {
    const limit = options?.limit ?? 50

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(options?.cursor
          ? { createdAt: { lt: await this.getMessageCreatedAt(options.cursor) } }
          : {}),
      },
      select: messageSelect,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })

    const hasMore = messages.length > limit
    const page = hasMore ? messages.slice(0, limit) : messages

    return {
      messages: page as Message[],
      nextCursor: hasMore ? page[page.length - 1].id : null,
    }
  }

  async markMessagesAsRead(
    conversationId: string,
    readerRole: 'CUSTOMER' | 'PROVIDER'
  ): Promise<void> {
    const senderToMark = readerRole === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER'
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderType: senderToMark,
        readAt: null,
      },
      data: { readAt: new Date() },
    })
  }

  async getUnreadCount(
    conversationId: string,
    readerRole: 'CUSTOMER' | 'PROVIDER'
  ): Promise<number> {
    const senderToCount = readerRole === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER'
    return prisma.message.count({
      where: {
        conversationId,
        senderType: senderToCount,
        readAt: null,
      },
    })
  }

  async getInboxForProvider(providerUserId: string): Promise<InboxItem[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        booking: {
          provider: { userId: providerUserId },
        },
      },
      select: {
        bookingId: true,
        booking: {
          select: {
            bookingDate: true,
            service: { select: { name: true } },
            customer: { select: { firstName: true, lastName: true } },
          },
        },
        messages: {
          select: { id: true, senderType: true, content: true, createdAt: true, readAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    const items: InboxItem[] = []
    for (const conv of conversations) {
      if (conv.messages.length === 0) continue
      const last = conv.messages[0]
      const unreadCount = conv.messages.filter(
        (m) => m.senderType === 'CUSTOMER' && m.readAt === null
      ).length
      items.push({
        bookingId: conv.bookingId,
        bookingDate: conv.booking.bookingDate,
        serviceName: conv.booking.service.name,
        customerName: `${conv.booking.customer.firstName} ${conv.booking.customer.lastName}`,
        lastMessageContent: last.content,
        lastMessageSenderType: last.senderType as 'CUSTOMER' | 'PROVIDER',
        lastMessageAt: last.createdAt,
        unreadCount,
      })
    }

    return items.sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
      return b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    })
  }

  async getTotalUnreadForProvider(providerUserId: string): Promise<number> {
    return prisma.message.count({
      where: {
        senderType: 'CUSTOMER',
        readAt: null,
        conversation: {
          booking: {
            provider: { userId: providerUserId },
          },
        },
      },
    })
  }

  private async getMessageCreatedAt(messageId: string): Promise<Date> {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { createdAt: true },
    })
    return msg?.createdAt ?? new Date()
  }
}
