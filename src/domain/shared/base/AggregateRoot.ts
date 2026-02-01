/**
 * AggregateRoot - Base class for domain aggregate roots
 *
 * Aggregates are clusters of entities and value objects with a defined boundary.
 * The aggregate root is the only entity within the aggregate that external
 * objects can hold references to.
 *
 * Key characteristics:
 * - Entry point for all operations on the aggregate
 * - Enforces business invariants across all entities in the aggregate
 * - Transactional consistency boundary
 * - Can emit domain events for decoupled side-effects
 *
 * @example
 * ```typescript
 * class Booking extends AggregateRoot<BookingProps> {
 *   private constructor(props: BookingProps) {
 *     super(props)
 *   }
 *
 *   static create(data: CreateBookingData): Result<Booking, ValidationError> {
 *     // Validation logic
 *     return Result.ok(new Booking({ ...data, status: 'pending' }))
 *   }
 *
 *   confirm(): Result<void, InvalidOperationError> {
 *     if (this.props.status !== 'pending') {
 *       return Result.fail(new InvalidOperationError('Only pending bookings can be confirmed'))
 *     }
 *     this.props.status = 'confirmed'
 *     this.touch()
 *     return Result.ok(undefined)
 *   }
 * }
 * ```
 */
import { Entity, EntityProps } from './Entity'
import type { IDomainEvent } from '@/infrastructure/events'

export abstract class AggregateRoot<T extends EntityProps> extends Entity<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _domainEvents: IDomainEvent<any>[] = []

  constructor(props: T) {
    super(props)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDomainEvents(): IDomainEvent<any>[] {
    return [...this._domainEvents]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected addDomainEvent(event: IDomainEvent<any>): void {
    this._domainEvents.push(event)
  }

  clearDomainEvents(): void {
    this._domainEvents = []
  }
}
