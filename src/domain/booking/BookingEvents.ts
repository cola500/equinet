import { randomUUID } from 'crypto'
import type { IDomainEvent } from '@/infrastructure/events'

// --- Event types ---

export const BOOKING_EVENT_TYPES = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_STATUS_CHANGED: 'BOOKING_STATUS_CHANGED',
  BOOKING_PAYMENT_RECEIVED: 'BOOKING_PAYMENT_RECEIVED',
} as const

// --- Payload interfaces ---

export interface BookingCreatedPayload {
  bookingId: string
  customerId: string
  providerId: string
  providerUserId: string
  customerName: string
  serviceName: string
  bookingDate: string
  startTime: string
  horseName?: string
}

export interface BookingStatusChangedPayload {
  bookingId: string
  customerId: string
  providerId: string
  providerUserId: string
  customerName: string
  providerName: string
  serviceName: string
  bookingDate: string
  startTime: string
  oldStatus: string
  newStatus: string
  changedByUserType: 'provider' | 'customer'
}

export interface BookingPaymentReceivedPayload {
  bookingId: string
  customerId: string
  providerId: string
  providerUserId: string
  customerName: string
  serviceName: string
  bookingDate: string
  amount: number
  currency: string
  paymentId: string
}

// --- Event interfaces ---

export interface BookingCreatedEvent extends IDomainEvent<BookingCreatedPayload> {
  eventType: typeof BOOKING_EVENT_TYPES.BOOKING_CREATED
}

export interface BookingStatusChangedEvent extends IDomainEvent<BookingStatusChangedPayload> {
  eventType: typeof BOOKING_EVENT_TYPES.BOOKING_STATUS_CHANGED
}

export interface BookingPaymentReceivedEvent extends IDomainEvent<BookingPaymentReceivedPayload> {
  eventType: typeof BOOKING_EVENT_TYPES.BOOKING_PAYMENT_RECEIVED
}

export type BookingEvent =
  | BookingCreatedEvent
  | BookingStatusChangedEvent
  | BookingPaymentReceivedEvent

// --- Factory functions ---

export function createBookingCreatedEvent(
  payload: BookingCreatedPayload
): BookingCreatedEvent {
  return {
    eventId: randomUUID(),
    eventType: BOOKING_EVENT_TYPES.BOOKING_CREATED,
    occurredAt: new Date(),
    payload,
  }
}

export function createBookingStatusChangedEvent(
  payload: BookingStatusChangedPayload
): BookingStatusChangedEvent {
  return {
    eventId: randomUUID(),
    eventType: BOOKING_EVENT_TYPES.BOOKING_STATUS_CHANGED,
    occurredAt: new Date(),
    payload,
  }
}

export function createBookingPaymentReceivedEvent(
  payload: BookingPaymentReceivedPayload
): BookingPaymentReceivedEvent {
  return {
    eventId: randomUUID(),
    eventType: BOOKING_EVENT_TYPES.BOOKING_PAYMENT_RECEIVED,
    occurredAt: new Date(),
    payload,
  }
}
