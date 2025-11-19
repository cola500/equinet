/**
 * ValueObject - Base class for domain value objects
 *
 * Value objects are domain concepts defined by their properties, not by identity.
 * Two value objects are equal if all their properties are equal.
 *
 * Key characteristics:
 * - No unique identifier
 * - Immutable (cannot change after creation)
 * - Structural equality (all properties must match)
 * - Self-validating (validation in constructor)
 *
 * @example
 * ```typescript
 * interface TimeSlotProps {
 *   startTime: string // "10:00"
 *   endTime: string   // "11:00"
 * }
 *
 * class TimeSlot extends ValueObject<TimeSlotProps> {
 *   private constructor(props: TimeSlotProps) {
 *     super(props)
 *   }
 *
 *   static create(startTime: string, endTime: string): Result<TimeSlot, ValidationError> {
 *     const guardResult = Guard.combine([
 *       Guard.againstNullOrUndefined(startTime, 'startTime'),
 *       Guard.againstNullOrUndefined(endTime, 'endTime'),
 *     ])
 *
 *     if (guardResult.isFailure) {
 *       return Result.fail(new ValidationError(guardResult.error))
 *     }
 *
 *     return Result.ok(new TimeSlot({ startTime, endTime }))
 *   }
 *
 *   get startTime() { return this.props.startTime }
 *   get endTime() { return this.props.endTime }
 *
 *   overlaps(other: TimeSlot): boolean {
 *     // Business logic here
 *   }
 * }
 * ```
 */
export abstract class ValueObject<T> {
  protected readonly props: T

  constructor(props: T) {
    // Make properties deeply immutable
    this.props = Object.freeze(props)
  }

  /**
   * Value objects are equal if all properties are equal
   */
  equals(vo?: ValueObject<T>): boolean {
    if (!vo) {
      return false
    }

    if (this === vo) {
      return true
    }

    if (!(vo instanceof ValueObject)) {
      return false
    }

    return this.deepEquals(this.props, vo.props)
  }

  /**
   * Deep equality check for nested objects
   */
  private deepEquals(obj1: unknown, obj2: unknown): boolean {
    if (obj1 === obj2) {
      return true
    }

    if (
      obj1 === null ||
      obj2 === null ||
      typeof obj1 !== 'object' ||
      typeof obj2 !== 'object'
    ) {
      return false
    }

    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)

    if (keys1.length !== keys2.length) {
      return false
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false
      }

      const val1 = (obj1 as Record<string, unknown>)[key]
      const val2 = (obj2 as Record<string, unknown>)[key]

      // Handle Date objects
      if (val1 instanceof Date && val2 instanceof Date) {
        if (val1.getTime() !== val2.getTime()) {
          return false
        }
        continue
      }

      // Handle nested objects
      if (typeof val1 === 'object' && typeof val2 === 'object') {
        if (!this.deepEquals(val1, val2)) {
          return false
        }
        continue
      }

      // Primitive comparison
      if (val1 !== val2) {
        return false
      }
    }

    return true
  }

  /**
   * Get a plain object representation (for serialization)
   */
  toJSON(): T {
    return JSON.parse(JSON.stringify(this.props))
  }
}
