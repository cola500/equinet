/**
 * Entity - Base class for domain entities
 *
 * Entities are domain objects with identity. Two entities are equal if they
 * have the same ID, even if their properties differ.
 *
 * Key characteristics:
 * - Has unique identifier (ID)
 * - Mutable (properties can change over time)
 * - Identity-based equality (id === id)
 * - Lifecycle tracked (createdAt, updatedAt)
 *
 * @example
 * ```typescript
 * class Booking extends Entity<BookingProps> {
 *   get customerId() { return this.props.customerId }
 *   get date() { return this.props.date }
 *
 *   cancel(): Result<void, Error> {
 *     if (this.props.status === 'completed') {
 *       return Result.fail(new InvalidOperationError('Cannot cancel completed booking'))
 *     }
 *     this.props.status = 'cancelled'
 *     return Result.ok(undefined)
 *   }
 * }
 * ```
 */
export interface EntityProps {
  id: string
  createdAt?: Date
  updatedAt?: Date
}

export abstract class Entity<T extends EntityProps> {
  protected readonly props: T

  constructor(props: T) {
    this.props = {
      ...props,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    }
  }

  /**
   * Entity ID (unique identifier)
   */
  get id(): string {
    return this.props.id
  }

  /**
   * When entity was created
   */
  get createdAt(): Date {
    return this.props.createdAt!
  }

  /**
   * When entity was last updated
   */
  get updatedAt(): Date {
    return this.props.updatedAt!
  }

  /**
   * Entities are equal if they have the same ID
   */
  equals(entity?: Entity<T>): boolean {
    if (!entity) {
      return false
    }

    if (this === entity) {
      return true
    }

    if (!(entity instanceof Entity)) {
      return false
    }

    return this.id === entity.id
  }

  /**
   * Mark entity as updated (for optimistic concurrency)
   */
  protected touch(): void {
    this.props.updatedAt = new Date()
  }

  /**
   * Clone entity with updated properties
   */
  protected clone(newProps: Partial<T>): this {
    const Constructor = this.constructor as new (props: T) => this
    return new Constructor({
      ...this.props,
      ...newProps,
      updatedAt: new Date(),
    })
  }
}
