import type { IEventHandler } from '@/infrastructure/events'
import { InMemoryEventDispatcher } from '@/infrastructure/events'
import type { BookingCreatedEvent, BookingStatusChangedEvent, BookingPaymentReceivedEvent } from './BookingEvents'
import { BOOKING_EVENT_TYPES } from './BookingEvents'
import { NotificationType } from '@/domain/notification/NotificationService'
import { formatNotifDate } from '@/lib/notification-helpers'

// --- Dependency interfaces (for DI / testability) ---

export interface IBookingEmailService {
  sendBookingConfirmation(bookingId: string): Promise<unknown>
  sendBookingStatusChange(bookingId: string, newStatus: string): Promise<unknown>
  sendPaymentConfirmation(bookingId: string): Promise<unknown>
}

export interface INotificationServiceLike {
  createAsync(input: {
    userId: string
    type: string
    message: string
    linkUrl?: string
    metadata?: Record<string, string>
  }): Promise<void> | void
}

export interface ILoggerLike {
  info(message: string, context: Record<string, unknown>): void
  error(message: string, error: Error, context?: Record<string, unknown>): void
}

// --- Status label / notification type mappings ---

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'bekraftad',
  cancelled: 'avbokad',
  completed: 'markerad som genomförd',
}

const STATUS_TO_NOTIF_TYPE: Record<string, string> = {
  confirmed: NotificationType.BOOKING_CONFIRMED,
  cancelled: NotificationType.BOOKING_CANCELLED,
  completed: NotificationType.BOOKING_COMPLETED,
}

const EMAIL_STATUSES = new Set(['confirmed', 'cancelled', 'completed'])

// --- Handlers ---

export class BookingCreatedEmailHandler implements IEventHandler<BookingCreatedEvent> {
  constructor(private emailService: IBookingEmailService) {}

  async handle(event: BookingCreatedEvent): Promise<void> {
    try {
      await this.emailService.sendBookingConfirmation(event.payload.bookingId)
    } catch {
      // Isolated -- email failure must not propagate
    }
  }
}

export class BookingCreatedNotificationHandler implements IEventHandler<BookingCreatedEvent> {
  constructor(private notificationService: INotificationServiceLike) {}

  async handle(event: BookingCreatedEvent): Promise<void> {
    const p = event.payload
    const dateStr = formatNotifDate(p.bookingDate)
    const horsePart = p.horseName ? ` for ${p.horseName}` : ''

    await this.notificationService.createAsync({
      userId: p.providerUserId,
      type: NotificationType.BOOKING_CREATED,
      message: `Ny bokning: ${p.customerName} har bokat ${p.serviceName} den ${dateStr} kl ${p.startTime}${horsePart}`,
      linkUrl: '/provider/bookings',
      metadata: { bookingId: p.bookingId },
    })
  }
}

export class BookingCreatedLogHandler implements IEventHandler<BookingCreatedEvent> {
  constructor(private logger: ILoggerLike) {}

  async handle(event: BookingCreatedEvent): Promise<void> {
    this.logger.info('Booking created successfully', {
      bookingId: event.payload.bookingId,
      customerId: event.payload.customerId,
      providerId: event.payload.providerId,
    })
  }
}

export class StatusChangedEmailHandler implements IEventHandler<BookingStatusChangedEvent> {
  constructor(private emailService: IBookingEmailService) {}

  async handle(event: BookingStatusChangedEvent): Promise<void> {
    if (!EMAIL_STATUSES.has(event.payload.newStatus)) return

    try {
      await this.emailService.sendBookingStatusChange(
        event.payload.bookingId,
        event.payload.newStatus,
      )
    } catch {
      // Isolated
    }
  }
}

export class StatusChangedNotificationHandler implements IEventHandler<BookingStatusChangedEvent> {
  constructor(private notificationService: INotificationServiceLike) {}

  async handle(event: BookingStatusChangedEvent): Promise<void> {
    const p = event.payload
    const notifType = STATUS_TO_NOTIF_TYPE[p.newStatus]
    if (!notifType) return

    const dateStr = formatNotifDate(p.bookingDate)
    const timeStr = p.startTime ? ` kl ${p.startTime}` : ''
    const statusLabel = STATUS_LABELS[p.newStatus] || p.newStatus

    if (p.changedByUserType === 'provider') {
      // Notify customer
      await this.notificationService.createAsync({
        userId: p.customerId,
        type: notifType,
        message: `${p.serviceName} hos ${p.providerName} den ${dateStr}${timeStr} har blivit ${statusLabel}`,
        linkUrl: '/customer/bookings',
        metadata: { bookingId: p.bookingId },
      })
    } else {
      // Notify provider
      const verb = statusLabel === 'avbokad' ? 'avbokat' : statusLabel
      await this.notificationService.createAsync({
        userId: p.providerUserId,
        type: notifType,
        message: `${p.customerName} har ${verb} ${p.serviceName} den ${dateStr}`,
        linkUrl: '/provider/bookings',
        metadata: { bookingId: p.bookingId },
      })
    }
  }
}

export class PaymentReceivedEmailHandler implements IEventHandler<BookingPaymentReceivedEvent> {
  constructor(private emailService: IBookingEmailService) {}

  async handle(event: BookingPaymentReceivedEvent): Promise<void> {
    try {
      await this.emailService.sendPaymentConfirmation(event.payload.bookingId)
    } catch {
      // Isolated
    }
  }
}

export class PaymentReceivedNotificationHandler implements IEventHandler<BookingPaymentReceivedEvent> {
  constructor(private notificationService: INotificationServiceLike) {}

  async handle(event: BookingPaymentReceivedEvent): Promise<void> {
    const p = event.payload
    const dateStr = formatNotifDate(p.bookingDate)

    await this.notificationService.createAsync({
      userId: p.providerUserId,
      type: NotificationType.PAYMENT_RECEIVED,
      message: `Betalning mottagen: ${p.customerName} betalade ${p.amount} kr for ${p.serviceName} (${dateStr})`,
      linkUrl: '/provider/bookings',
      metadata: { bookingId: p.bookingId, paymentId: p.paymentId },
    })
  }
}

// --- Factory ---

export function createBookingEventDispatcher(deps: {
  emailService: IBookingEmailService
  notificationService: INotificationServiceLike
  logger: ILoggerLike
}) {
  const dispatcher = new InMemoryEventDispatcher()

  // BOOKING_CREATED
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_CREATED, new BookingCreatedEmailHandler(deps.emailService))
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_CREATED, new BookingCreatedNotificationHandler(deps.notificationService))
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_CREATED, new BookingCreatedLogHandler(deps.logger))

  // BOOKING_STATUS_CHANGED
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_STATUS_CHANGED, new StatusChangedEmailHandler(deps.emailService))
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_STATUS_CHANGED, new StatusChangedNotificationHandler(deps.notificationService))

  // BOOKING_PAYMENT_RECEIVED
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_PAYMENT_RECEIVED, new PaymentReceivedEmailHandler(deps.emailService))
  dispatcher.register(BOOKING_EVENT_TYPES.BOOKING_PAYMENT_RECEIVED, new PaymentReceivedNotificationHandler(deps.notificationService))

  return dispatcher
}
