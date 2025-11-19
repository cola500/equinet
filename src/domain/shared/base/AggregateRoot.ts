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
 * - Can emit domain events (future enhancement)
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

export abstract class AggregateRoot<T extends EntityProps> extends Entity<T> {
  // Domain events could be added here in the future
  // private _domainEvents: DomainEvent[] = []

  constructor(props: T) {
    super(props)
  }

  /**
   * Get domain events (for future event-driven architecture)
   */
  // getDomainEvents(): DomainEvent[] {
  //   return this._domainEvents
  // }

  /**
   * Add domain event (for future event-driven architecture)
   */
  // protected addDomainEvent(event: DomainEvent): void {
  //   this._domainEvents.push(event)
  // }

  /**
   * Clear domain events (typically after dispatching)
   */
  // clearDomainEvents(): void {
  //   this._domainEvents = []
  // }
}
