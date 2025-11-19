/**
 * DomainError - Base class for all domain errors
 *
 * Domain errors represent business rule violations, not technical failures.
 * They should be explicit, descriptive, and part of the ubiquitous language.
 *
 * @example
 * ```typescript
 * class BookingOverlapError extends DomainError {
 *   constructor(conflictingBookingId: string) {
 *     super(
 *       `Booking overlaps with existing booking ${conflictingBookingId}`,
 *       'BOOKING_OVERLAP'
 *     )
 *   }
 * }
 * ```
 */
export abstract class DomainError extends Error {
  public readonly code: string
  public readonly timestamp: Date

  constructor(message: string, code: string) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.timestamp = new Date()

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Serialize error for logging or API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
    }
  }
}

/**
 * ValidationError - Input validation failures
 */
export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR')
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
    }
  }
}

/**
 * NotFoundError - Entity not found
 */
export class NotFoundError extends DomainError {
  constructor(entityName: string, id: string) {
    super(`${entityName} with id ${id} not found`, 'NOT_FOUND')
  }
}

/**
 * ConflictError - Business rule conflict
 */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT')
  }
}

/**
 * UnauthorizedError - Access denied
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED')
  }
}

/**
 * InvalidOperationError - Operation not allowed in current state
 */
export class InvalidOperationError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_OPERATION')
  }
}
