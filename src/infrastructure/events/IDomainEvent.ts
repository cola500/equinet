/**
 * Base interface for all domain events.
 *
 * Domain events represent something that happened in the domain.
 * They carry all the data needed for handlers to react -- handlers
 * should NEVER need to query the database.
 */
export interface IDomainEvent<TPayload = Record<string, unknown>> {
  readonly eventId: string
  readonly eventType: string
  readonly occurredAt: Date
  readonly payload: TPayload
}
