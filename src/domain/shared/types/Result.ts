/**
 * Result Pattern - Type-safe error handling without exceptions
 *
 * Inspired by Rust's Result<T, E> and functional error handling.
 * Eliminates try-catch in business logic and makes error paths explicit.
 *
 * @example
 * ```typescript
 * function createBooking(data: BookingData): Result<Booking, ValidationError> {
 *   if (!data.date) {
 *     return Result.fail(new ValidationError('Date is required'))
 *   }
 *   return Result.ok(new Booking(data))
 * }
 *
 * const result = createBooking(data)
 * if (result.isSuccess) {
 *   console.log(result.value) // Type: Booking
 * } else {
 *   console.error(result.error) // Type: ValidationError
 * }
 * ```
 */
export class Result<T, E = Error> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  /**
   * Create a successful result with a value
   */
  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined)
  }

  /**
   * Create a failed result with an error
   */
  static fail<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error)
  }

  /**
   * Combine multiple results - fails if any result fails
   * Returns array of values if all succeed
   */
  static combine<T, E = Error>(results: Result<T, E>[]): Result<T[], E> {
    for (const result of results) {
      if (!result.isSuccess) {
        return Result.fail(result.error!)
      }
    }
    return Result.ok(results.map((r) => r.value!))
  }

  /**
   * Check if result is successful
   */
  get isSuccess(): boolean {
    return this._isSuccess
  }

  /**
   * Check if result is failed
   */
  get isFailure(): boolean {
    return !this._isSuccess
  }

  /**
   * Get the success value (throws if failed)
   */
  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Cannot get value from failed result')
    }
    return this._value!
  }

  /**
   * Get the error (throws if successful)
   */
  get error(): E {
    if (this._isSuccess) {
      throw new Error('Cannot get error from successful result')
    }
    return this._error!
  }

  /**
   * Get value or default if failed
   */
  getOrElse(defaultValue: T): T {
    return this._isSuccess ? this._value! : defaultValue
  }

  /**
   * Map the value if successful
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._isSuccess) {
      return Result.ok(fn(this._value!))
    }
    return Result.fail(this._error!)
  }

  /**
   * FlatMap for chaining Results
   */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this._isSuccess) {
      return fn(this._value!)
    }
    return Result.fail(this._error!)
  }

  /**
   * Map the error if failed
   */
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (!this._isSuccess) {
      return Result.fail(fn(this._error!))
    }
    return Result.ok(this._value!)
  }
}
