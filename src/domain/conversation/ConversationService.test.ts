/**
 * @domain conversation
 * BDD dual-loop integration tests for ConversationService
 */
import { describe, it, expect, beforeEach } from 'vitest'
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

  beforeEach(() => {
    repo = new MockConversationRepository()
    service = new ConversationService({ conversationRepository: repo })
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
})
