import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageNotifier } from './MessageNotifier'
import { NotificationType } from './NotificationService'

// -----------------------------------------------------------
// Test helpers
// -----------------------------------------------------------

const mockCreateAsync = vi.fn().mockResolvedValue(undefined)
const mockSendToUser = vi.fn().mockResolvedValue(undefined)

function makeNotifier() {
  return new MessageNotifier({
    notificationService: { createAsync: mockCreateAsync },
    pushDeliveryService: { sendToUser: mockSendToUser },
  })
}

// -----------------------------------------------------------
// MessageNotifier
// -----------------------------------------------------------

describe('MessageNotifier', () => {
  beforeEach(() => {
    mockCreateAsync.mockReset().mockResolvedValue(undefined)
    mockSendToUser.mockReset().mockResolvedValue(undefined)
  })

  describe('notifyNewMessage — customer sends to provider', () => {
    it('creates in-app notification for provider recipient', async () => {
      const notifier = makeNotifier()

      await notifier.notifyNewMessage({
        bookingId: 'booking-1',
        senderType: 'CUSTOMER',
        senderName: 'Anna Karlsson',
        recipientUserId: 'provider-user-1',
        recipientRole: 'PROVIDER',
        contentPreview: 'Hej, stämmer det att du kommer tisdag?',
        deepLink: '/provider/bookings/booking-1/messages',
      })

      expect(mockCreateAsync).toHaveBeenCalledOnce()
      const call = mockCreateAsync.mock.calls[0][0]
      expect(call.userId).toBe('provider-user-1')
      expect(call.type).toBe(NotificationType.MESSAGE_RECEIVED)
      expect(call.message).toContain('Anna Karlsson')
      expect(call.linkUrl).toBe('/provider/bookings/booking-1/messages')
    })

    it('sends push notification to provider recipient', async () => {
      const notifier = makeNotifier()

      await notifier.notifyNewMessage({
        bookingId: 'booking-1',
        senderType: 'CUSTOMER',
        senderName: 'Anna Karlsson',
        recipientUserId: 'provider-user-1',
        recipientRole: 'PROVIDER',
        contentPreview: 'Hej!',
        deepLink: '/provider/bookings/booking-1/messages',
      })

      expect(mockSendToUser).toHaveBeenCalledOnce()
      const [userId, payload] = mockSendToUser.mock.calls[0]
      expect(userId).toBe('provider-user-1')
      expect(payload.title).toContain('Anna Karlsson')
      expect(payload.url).toBe('/provider/bookings/booking-1/messages')
    })
  })

  describe('notifyNewMessage — provider sends to customer', () => {
    it('creates in-app notification for customer recipient', async () => {
      const notifier = makeNotifier()

      await notifier.notifyNewMessage({
        bookingId: 'booking-1',
        senderType: 'PROVIDER',
        senderName: 'Hovslageri AB',
        recipientUserId: 'customer-user-1',
        recipientRole: 'CUSTOMER',
        contentPreview: 'Hej! Jag kommer fredag.',
        deepLink: '/customer/bookings/booking-1',
      })

      expect(mockCreateAsync).toHaveBeenCalledOnce()
      const call = mockCreateAsync.mock.calls[0][0]
      expect(call.userId).toBe('customer-user-1')
      expect(call.linkUrl).toBe('/customer/bookings/booking-1')
    })
  })

  describe('fire-and-forget error handling', () => {
    it('does not throw if notificationService fails', async () => {
      mockCreateAsync.mockRejectedValue(new Error('DB error'))
      const notifier = makeNotifier()

      await expect(
        notifier.notifyNewMessage({
          bookingId: 'booking-1',
          senderType: 'CUSTOMER',
          senderName: 'Anna',
          recipientUserId: 'provider-user-1',
          recipientRole: 'PROVIDER',
          contentPreview: 'Test',
          deepLink: '/provider/bookings/booking-1/messages',
        })
      ).resolves.not.toThrow()
    })

    it('does not throw if pushDeliveryService fails', async () => {
      mockSendToUser.mockRejectedValue(new Error('Push error'))
      const notifier = makeNotifier()

      await expect(
        notifier.notifyNewMessage({
          bookingId: 'booking-1',
          senderType: 'CUSTOMER',
          senderName: 'Anna',
          recipientUserId: 'provider-user-1',
          recipientRole: 'PROVIDER',
          contentPreview: 'Test',
          deepLink: '/provider/bookings/booking-1/messages',
        })
      ).resolves.not.toThrow()
    })
  })

  describe('content preview truncation', () => {
    it('truncates content preview to 80 characters in push body', async () => {
      const notifier = makeNotifier()
      const longContent = 'a'.repeat(100)

      await notifier.notifyNewMessage({
        bookingId: 'booking-1',
        senderType: 'CUSTOMER',
        senderName: 'Anna',
        recipientUserId: 'provider-user-1',
        recipientRole: 'PROVIDER',
        contentPreview: longContent,
        deepLink: '/provider/bookings/booking-1/messages',
      })

      const [, payload] = mockSendToUser.mock.calls[0]
      expect(payload.body.length).toBeLessThanOrEqual(83) // 80 + "..."
    })
  })
})
