import { describe, it, expect, vi } from 'vitest'
import {
  BookingCreatedEmailHandler,
  BookingCreatedNotificationHandler,
  BookingCreatedLogHandler,
  StatusChangedEmailHandler,
  StatusChangedNotificationHandler,
  PaymentReceivedEmailHandler,
  PaymentReceivedNotificationHandler,
  BookingCreatedPushHandler,
  StatusChangedPushHandler,
  createBookingEventDispatcher,
} from './BookingEventHandlers'
import type { BookingCreatedEvent, BookingStatusChangedEvent, BookingPaymentReceivedEvent } from './BookingEvents'
import { BOOKING_EVENT_TYPES } from './BookingEvents'

// --- Test data factories ---

function createdEvent(overrides?: Partial<BookingCreatedEvent['payload']>): BookingCreatedEvent {
  return {
    eventId: 'evt-1',
    eventType: BOOKING_EVENT_TYPES.BOOKING_CREATED,
    occurredAt: new Date('2026-02-01'),
    payload: {
      bookingId: 'booking-1',
      customerId: 'customer-1',
      providerId: 'provider-1',
      providerUserId: 'provider-user-1',
      customerName: 'Anna Svensson',
      serviceName: 'Hovslagar',
      bookingDate: '2026-02-10',
      startTime: '09:00',
      ...overrides,
    },
  }
}

function statusChangedEvent(overrides?: Partial<BookingStatusChangedEvent['payload']>): BookingStatusChangedEvent {
  return {
    eventId: 'evt-2',
    eventType: BOOKING_EVENT_TYPES.BOOKING_STATUS_CHANGED,
    occurredAt: new Date('2026-02-01'),
    payload: {
      bookingId: 'booking-1',
      customerId: 'customer-1',
      providerId: 'provider-1',
      providerUserId: 'provider-user-1',
      customerName: 'Anna Svensson',
      providerName: 'Jons Hovslageri',
      serviceName: 'Hovslagar',
      bookingDate: '2026-02-10',
      startTime: '09:00',
      oldStatus: 'pending',
      newStatus: 'confirmed',
      changedByUserType: 'provider',
      ...overrides,
    },
  }
}

function paymentEvent(overrides?: Partial<BookingPaymentReceivedEvent['payload']>): BookingPaymentReceivedEvent {
  return {
    eventId: 'evt-3',
    eventType: BOOKING_EVENT_TYPES.BOOKING_PAYMENT_RECEIVED,
    occurredAt: new Date('2026-02-01'),
    payload: {
      bookingId: 'booking-1',
      customerId: 'customer-1',
      providerId: 'provider-1',
      providerUserId: 'provider-user-1',
      customerName: 'Anna Svensson',
      serviceName: 'Hovslagar',
      bookingDate: '2026-02-10',
      amount: 1500,
      currency: 'SEK',
      paymentId: 'payment-1',
      ...overrides,
    },
  }
}

// --- Mock dependencies ---

function createMockEmailService() {
  return {
    sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    sendBookingStatusChange: vi.fn().mockResolvedValue(undefined),
    sendPaymentConfirmation: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockNotificationService() {
  return {
    createAsync: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockPushService() {
  return {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    security: vi.fn(),
  }
}

// --- Tests ---

describe('BookingCreatedEmailHandler', () => {
  it('sends booking confirmation email with bookingId', async () => {
    const emailService = createMockEmailService()
    const handler = new BookingCreatedEmailHandler(emailService)

    await handler.handle(createdEvent())

    expect(emailService.sendBookingConfirmation).toHaveBeenCalledWith('booking-1')
  })

  it('does not throw when email service fails', async () => {
    const emailService = createMockEmailService()
    emailService.sendBookingConfirmation.mockRejectedValue(new Error('Email failed'))
    const handler = new BookingCreatedEmailHandler(emailService)

    await expect(handler.handle(createdEvent())).resolves.toBeUndefined()
  })
})

describe('BookingCreatedNotificationHandler', () => {
  it('creates notification for provider with correct message', async () => {
    const notifService = createMockNotificationService()
    const handler = new BookingCreatedNotificationHandler(notifService)

    await handler.handle(createdEvent())

    expect(notifService.createAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user-1',
        type: 'booking_created',
        linkUrl: '/provider/bookings',
        metadata: { bookingId: 'booking-1' },
      })
    )
  })

  it('includes horse name in notification when present', async () => {
    const notifService = createMockNotificationService()
    const handler = new BookingCreatedNotificationHandler(notifService)

    await handler.handle(createdEvent({ horseName: 'Blansen' }))

    const call = notifService.createAsync.mock.calls[0][0]
    expect(call.message).toContain('Blansen')
  })
})

describe('BookingCreatedLogHandler', () => {
  it('logs booking creation with bookingId', async () => {
    const logger = createMockLogger()
    const handler = new BookingCreatedLogHandler(logger)

    await handler.handle(createdEvent())

    expect(logger.info).toHaveBeenCalledWith(
      'Booking created successfully',
      expect.objectContaining({ bookingId: 'booking-1' })
    )
  })
})

describe('StatusChangedEmailHandler', () => {
  it('sends status change email for confirmed status', async () => {
    const emailService = createMockEmailService()
    const handler = new StatusChangedEmailHandler(emailService)

    await handler.handle(statusChangedEvent({ newStatus: 'confirmed' }))

    expect(emailService.sendBookingStatusChange).toHaveBeenCalledWith('booking-1', 'confirmed', undefined)
  })

  it('sends cancellation message with email for cancelled status', async () => {
    const emailService = createMockEmailService()
    const handler = new StatusChangedEmailHandler(emailService)

    await handler.handle(statusChangedEvent({
      newStatus: 'cancelled',
      cancellationMessage: 'Sjuk häst',
    }))

    expect(emailService.sendBookingStatusChange).toHaveBeenCalledWith('booking-1', 'cancelled', 'Sjuk häst')
  })

  it('does not send email for pending status', async () => {
    const emailService = createMockEmailService()
    const handler = new StatusChangedEmailHandler(emailService)

    await handler.handle(statusChangedEvent({ newStatus: 'pending' }))

    expect(emailService.sendBookingStatusChange).not.toHaveBeenCalled()
  })
})

describe('StatusChangedNotificationHandler', () => {
  it('notifies customer when provider changes status', async () => {
    const notifService = createMockNotificationService()
    const handler = new StatusChangedNotificationHandler(notifService)

    await handler.handle(statusChangedEvent({
      changedByUserType: 'provider',
      newStatus: 'confirmed',
    }))

    expect(notifService.createAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-1',
        type: 'booking_confirmed',
        linkUrl: '/customer/bookings',
      })
    )
  })

  it('notifies provider when customer changes status', async () => {
    const notifService = createMockNotificationService()
    const handler = new StatusChangedNotificationHandler(notifService)

    await handler.handle(statusChangedEvent({
      changedByUserType: 'customer',
      newStatus: 'cancelled',
    }))

    expect(notifService.createAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user-1',
        type: 'booking_cancelled',
        linkUrl: '/provider/bookings',
      })
    )
  })

  it('includes cancellation message in notification', async () => {
    const notifService = createMockNotificationService()
    const handler = new StatusChangedNotificationHandler(notifService)

    await handler.handle(statusChangedEvent({
      changedByUserType: 'provider',
      newStatus: 'cancelled',
      cancellationMessage: 'Hästen är sjuk',
    }))

    const call = notifService.createAsync.mock.calls[0][0]
    expect(call.message).toContain('Hästen är sjuk')
  })
})

describe('PaymentReceivedEmailHandler', () => {
  it('sends payment confirmation email', async () => {
    const emailService = createMockEmailService()
    const handler = new PaymentReceivedEmailHandler(emailService)

    await handler.handle(paymentEvent())

    expect(emailService.sendPaymentConfirmation).toHaveBeenCalledWith('booking-1')
  })
})

describe('PaymentReceivedNotificationHandler', () => {
  it('creates notification for provider with amount', async () => {
    const notifService = createMockNotificationService()
    const handler = new PaymentReceivedNotificationHandler(notifService)

    await handler.handle(paymentEvent({ amount: 1500, currency: 'SEK' }))

    const call = notifService.createAsync.mock.calls[0][0]
    expect(call.userId).toBe('provider-user-1')
    expect(call.type).toBe('payment_received')
    expect(call.message).toContain('1500')
    expect(call.linkUrl).toBe('/provider/bookings')
  })
})

describe('BookingCreatedPushHandler', () => {
  it('sends push to provider with booking details', async () => {
    const pushService = createMockPushService()
    const handler = new BookingCreatedPushHandler(pushService)

    await handler.handle(createdEvent())

    expect(pushService.sendToUser).toHaveBeenCalledWith(
      'provider-user-1',
      expect.objectContaining({
        title: 'Ny bokning',
        category: 'BOOKING_REQUEST',
        bookingId: 'booking-1',
        url: '/provider/bookings',
      })
    )
    const call = pushService.sendToUser.mock.calls[0][1]
    expect(call.body).toContain('Anna Svensson')
    expect(call.body).toContain('Hovslagar')
  })

  it('does not throw when push service fails', async () => {
    const pushService = createMockPushService()
    pushService.sendToUser.mockRejectedValue(new Error('Push failed'))
    const handler = new BookingCreatedPushHandler(pushService)

    await expect(handler.handle(createdEvent())).resolves.toBeUndefined()
  })
})

describe('StatusChangedPushHandler', () => {
  it('sends push to customer when provider changes status', async () => {
    const pushService = createMockPushService()
    const handler = new StatusChangedPushHandler(pushService)

    await handler.handle(statusChangedEvent({
      changedByUserType: 'provider',
      newStatus: 'confirmed',
    }))

    expect(pushService.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({
        url: '/customer/bookings',
        bookingId: 'booking-1',
      })
    )
    const call = pushService.sendToUser.mock.calls[0][1]
    expect(call.title).toContain('bekräftad')
  })

  it('sends push to provider when customer changes status', async () => {
    const pushService = createMockPushService()
    const handler = new StatusChangedPushHandler(pushService)

    await handler.handle(statusChangedEvent({
      changedByUserType: 'customer',
      newStatus: 'cancelled',
    }))

    expect(pushService.sendToUser).toHaveBeenCalledWith(
      'provider-user-1',
      expect.objectContaining({
        url: '/provider/bookings',
        bookingId: 'booking-1',
      })
    )
  })

  it('does not throw when push service fails', async () => {
    const pushService = createMockPushService()
    pushService.sendToUser.mockRejectedValue(new Error('Push failed'))
    const handler = new StatusChangedPushHandler(pushService)

    await expect(handler.handle(statusChangedEvent())).resolves.toBeUndefined()
  })
})

describe('createBookingEventDispatcher', () => {
  it('creates dispatcher that handles BOOKING_CREATED events', async () => {
    const emailService = createMockEmailService()
    const notifService = createMockNotificationService()
    const logger = createMockLogger()

    const dispatcher = createBookingEventDispatcher({
      emailService,
      notificationService: notifService,
      logger,
    })

    await dispatcher.dispatch(createdEvent())

    expect(emailService.sendBookingConfirmation).toHaveBeenCalled()
    expect(notifService.createAsync).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalled()
  })

  it('creates dispatcher that handles BOOKING_STATUS_CHANGED events', async () => {
    const emailService = createMockEmailService()
    const notifService = createMockNotificationService()
    const logger = createMockLogger()

    const dispatcher = createBookingEventDispatcher({
      emailService,
      notificationService: notifService,
      logger,
    })

    await dispatcher.dispatch(statusChangedEvent({ newStatus: 'confirmed' }))

    expect(emailService.sendBookingStatusChange).toHaveBeenCalled()
    expect(notifService.createAsync).toHaveBeenCalled()
  })

  it('creates dispatcher that handles BOOKING_PAYMENT_RECEIVED events', async () => {
    const emailService = createMockEmailService()
    const notifService = createMockNotificationService()
    const logger = createMockLogger()

    const dispatcher = createBookingEventDispatcher({
      emailService,
      notificationService: notifService,
      logger,
    })

    await dispatcher.dispatch(paymentEvent())

    expect(emailService.sendPaymentConfirmation).toHaveBeenCalled()
    expect(notifService.createAsync).toHaveBeenCalled()
  })

  it('registers push handlers when pushService is provided', async () => {
    const emailService = createMockEmailService()
    const notifService = createMockNotificationService()
    const logger = createMockLogger()
    const pushService = createMockPushService()

    const dispatcher = createBookingEventDispatcher({
      emailService,
      notificationService: notifService,
      logger,
      pushService,
    })

    await dispatcher.dispatch(createdEvent())
    expect(pushService.sendToUser).toHaveBeenCalled()

    pushService.sendToUser.mockClear()
    await dispatcher.dispatch(statusChangedEvent({ newStatus: 'confirmed' }))
    expect(pushService.sendToUser).toHaveBeenCalled()
  })

  it('works without pushService (backwards compatible)', async () => {
    const emailService = createMockEmailService()
    const notifService = createMockNotificationService()
    const logger = createMockLogger()

    const dispatcher = createBookingEventDispatcher({
      emailService,
      notificationService: notifService,
      logger,
      // No pushService
    })

    // Should not throw
    await dispatcher.dispatch(createdEvent())
    expect(emailService.sendBookingConfirmation).toHaveBeenCalled()
  })
})
