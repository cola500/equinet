/**
 * @domain conversation
 * BDD dual-loop integration tests for ConversationService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConversationService } from './ConversationService'
import { MockConversationRepository } from '@/infrastructure/persistence/conversation/MockConversationRepository'
import type { BookingForConversation } from './ConversationService'

// -----------------------------------------------------------
// Test helpers
// -----------------------------------------------------------

function makeBooking(overrides: Partial<BookingForConversation> = {}): BookingForConversation {
  return {
    id: 'booking-1',
    customerId: 'customer-user-1',
    providerId: 'provider-1',
    providerUserId: 'provider-user-1',
    status: 'confirmed',
    bookingDate: new Date('2026-04-20'),
    customerName: 'Anna Karlsson',
    providerName: 'Hovslageri AB',
    ...overrides,
  }
}

// -----------------------------------------------------------
// Outer loop (integration): ConversationService with MockRepo
// -----------------------------------------------------------

describe('ConversationService', () => {
  let repo: MockConversationRepository
  let service: ConversationService
  let isFeatureEnabled: ReturnType<typeof vi.fn>

  beforeEach(() => {
    repo = new MockConversationRepository()
    isFeatureEnabled = vi.fn().mockResolvedValue(true)
    service = new ConversationService({ conversationRepository: repo, isFeatureEnabled })
  })

  // --------------------------------------------------------
  // sendMessage – happy path
  // --------------------------------------------------------

  describe('sendMessage', () => {
    it('creates a message for a confirmed booking (customer sender)', async () => {
      const booking = makeBooking()
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Hej, stämmer det att du kommer tisdag?',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.senderType).toBe('CUSTOMER')
      expect(result.value.content).toBe('Hej, stämmer det att du kommer tisdag?')
      expect(result.value.readAt).toBeNull()
    })

    it('creates a message for a pending booking (customer sender)', async () => {
      const booking = makeBooking({ status: 'pending' })
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Fråga innan bekräftelse',
      })

      expect(result.isSuccess).toBe(true)
    })

    it('creates a message for a completed booking within 30 days', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 10)
      const booking = makeBooking({ status: 'completed', bookingDate: recentDate })
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Tack för besöket!',
      })

      expect(result.isSuccess).toBe(true)
    })

    it('creates conversation lazily on first message', async () => {
      const booking = makeBooking()
      expect(await repo.findByBookingId('booking-1')).toBeNull()

      await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Första meddelandet',
      })

      expect(await repo.findByBookingId('booking-1')).not.toBeNull()
    })

    // --------------------------------------------------------
    // sendMessage – status gating
    // --------------------------------------------------------

    it('returns BOOKING_CLOSED error for cancelled booking', async () => {
      const booking = makeBooking({ status: 'cancelled' })
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Försök att skicka',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_CLOSED')
    })

    it('returns BOOKING_CLOSED error for no_show booking', async () => {
      const booking = makeBooking({ status: 'no_show' })
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Försök',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_CLOSED')
    })

    it('returns BOOKING_CLOSED for completed booking older than 30 days', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 31)
      const booking = makeBooking({ status: 'completed', bookingDate: oldDate })
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Sent too late',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_CLOSED')
    })

    // --------------------------------------------------------
    // sendMessage – content validation
    // --------------------------------------------------------

    it('returns CONTENT_EMPTY error for empty content', async () => {
      const booking = makeBooking()
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: '',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('CONTENT_EMPTY')
    })

    it('returns CONTENT_TOO_LONG error for content over 2000 chars', async () => {
      const booking = makeBooking()
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'a'.repeat(2001),
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('CONTENT_TOO_LONG')
    })
  })

  // --------------------------------------------------------
  // listMessages
  // --------------------------------------------------------

  describe('listMessages', () => {
    it('returns empty list when no conversation exists', async () => {
      const result = await service.listMessages({ bookingId: 'booking-1' })
      expect(result.messages).toEqual([])
      expect(result.nextCursor).toBeNull()
    })

    it('returns messages after they are sent', async () => {
      const booking = makeBooking()
      await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Meddelande 1',
      })
      const result = await service.listMessages({ bookingId: 'booking-1' })
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].content).toBe('Meddelande 1')
    })
  })

  // --------------------------------------------------------
  // markAsRead
  // --------------------------------------------------------

  describe('markAsRead', () => {
    it('marks provider messages as read for customer reader', async () => {
      // Seed a provider message
      const conv = await repo.createMessage({
        bookingId: 'booking-1',
        senderType: 'PROVIDER',
        senderId: 'provider-user-1',
        content: 'Svar från leverantör',
      })
      expect(conv.readAt).toBeNull()

      await service.markAsRead({ bookingId: 'booking-1', readerRole: 'CUSTOMER' })

      const messages = repo.getMessages()
      expect(messages.every((m) => m.readAt !== null)).toBe(true)
    })

    it('no-ops when no conversation exists', async () => {
      await expect(
        service.markAsRead({ bookingId: 'no-such-booking', readerRole: 'CUSTOMER' })
      ).resolves.not.toThrow()
    })
  })

  // --------------------------------------------------------
  // getInboxForProvider
  // --------------------------------------------------------

  describe('getInboxForProvider', () => {
    const PROVIDER_USER = 'provider-user-1'

    beforeEach(() => {
      repo.seedBookingContext('booking-1', {
        providerUserId: PROVIDER_USER,
        serviceName: 'Hovslagning',
        customerName: 'Anna Karlsson',
        bookingDate: new Date('2026-04-20'),
      })
      repo.seedBookingContext('booking-2', {
        providerUserId: PROVIDER_USER,
        serviceName: 'Hälsokontroll',
        customerName: 'Erik Svensson',
        bookingDate: new Date('2026-04-21'),
      })
      repo.seedBookingContext('booking-3', {
        providerUserId: 'other-provider',
        serviceName: 'Annan tjänst',
        customerName: 'Lars Ek',
        bookingDate: new Date('2026-04-22'),
      })
    })

    it('returns inbox items for provider, excluding other providers', async () => {
      await repo.createMessage({ bookingId: 'booking-1', senderType: 'CUSTOMER', senderId: 'c1', content: 'Hej' })
      await repo.createMessage({ bookingId: 'booking-2', senderType: 'CUSTOMER', senderId: 'c2', content: 'Fråga' })
      await repo.createMessage({ bookingId: 'booking-3', senderType: 'CUSTOMER', senderId: 'c3', content: 'Annan' })

      const items = await service.getInboxForProvider(PROVIDER_USER)
      expect(items).toHaveLength(2)
      expect(items.every((i) => ['booking-1', 'booking-2'].includes(i.bookingId))).toBe(true)
    })

    it('sorts unread first', async () => {
      await repo.createMessage({ bookingId: 'booking-2', senderType: 'CUSTOMER', senderId: 'c2', content: 'Läst' })
      await repo.createMessage({ bookingId: 'booking-1', senderType: 'CUSTOMER', senderId: 'c1', content: 'Oläst' })

      // Mark booking-2 as read
      const conv2 = await repo.findByBookingId('booking-2')
      if (conv2) await repo.markMessagesAsRead(conv2.id, 'PROVIDER')

      const items = await service.getInboxForProvider(PROVIDER_USER)
      expect(items[0].bookingId).toBe('booking-1')
      expect(items[0].unreadCount).toBe(1)
      expect(items[1].unreadCount).toBe(0)
    })

    it('returns empty list when provider has no conversations', async () => {
      const items = await service.getInboxForProvider('no-such-provider')
      expect(items).toHaveLength(0)
    })

    it('includes last message content and sender', async () => {
      await repo.createMessage({ bookingId: 'booking-1', senderType: 'CUSTOMER', senderId: 'c1', content: 'Senaste meddelandet' })

      const items = await service.getInboxForProvider(PROVIDER_USER)
      const item = items.find((i) => i.bookingId === 'booking-1')!
      expect(item.lastMessageContent).toBe('Senaste meddelandet')
      expect(item.lastMessageSenderType).toBe('CUSTOMER')
      expect(item.serviceName).toBe('Hovslagning')
      expect(item.customerName).toBe('Anna Karlsson')
    })
  })

  // --------------------------------------------------------
  // Feature flag gating
  // --------------------------------------------------------

  describe('feature flag: messaging disabled', () => {
    beforeEach(() => {
      isFeatureEnabled.mockResolvedValue(false)
    })

    it('sendMessage returns FEATURE_DISABLED when messaging flag is off', async () => {
      const booking = makeBooking()
      const result = await service.sendMessage({
        booking,
        senderType: 'CUSTOMER',
        senderId: 'customer-user-1',
        content: 'Hej',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('FEATURE_DISABLED')
    })

    it('listMessages returns empty list when messaging flag is off', async () => {
      const result = await service.listMessages({ bookingId: 'booking-1' })
      expect(result.messages).toEqual([])
      expect(result.nextCursor).toBeNull()
    })

    it('markAsRead no-ops when messaging flag is off', async () => {
      await expect(
        service.markAsRead({ bookingId: 'booking-1', readerRole: 'CUSTOMER' })
      ).resolves.not.toThrow()
    })

    it('getInboxForProvider returns empty list when messaging flag is off', async () => {
      const items = await service.getInboxForProvider('provider-user-1')
      expect(items).toEqual([])
    })

    it('getTotalUnreadForProvider returns 0 when messaging flag is off', async () => {
      const count = await service.getTotalUnreadForProvider('provider-user-1')
      expect(count).toBe(0)
    })
  })

  // --------------------------------------------------------
  // getTotalUnreadForProvider
  // --------------------------------------------------------

  describe('getTotalUnreadForProvider', () => {
    it('counts all unread customer messages across conversations', async () => {
      repo.seedBookingContext('booking-1', {
        providerUserId: 'prov-1',
        serviceName: 'S1',
        customerName: 'K1',
        bookingDate: new Date(),
      })
      repo.seedBookingContext('booking-2', {
        providerUserId: 'prov-1',
        serviceName: 'S2',
        customerName: 'K2',
        bookingDate: new Date(),
      })

      await repo.createMessage({ bookingId: 'booking-1', senderType: 'CUSTOMER', senderId: 'c1', content: 'A' })
      await repo.createMessage({ bookingId: 'booking-1', senderType: 'CUSTOMER', senderId: 'c1', content: 'B' })
      await repo.createMessage({ bookingId: 'booking-2', senderType: 'CUSTOMER', senderId: 'c2', content: 'C' })

      const count = await service.getTotalUnreadForProvider('prov-1')
      expect(count).toBe(3)
    })

    it('returns 0 when no unread messages', async () => {
      const count = await service.getTotalUnreadForProvider('no-provider')
      expect(count).toBe(0)
    })
  })
})
