/**
 * Guard - Validation utilities for domain logic
 *
 * Provides common validation patterns to keep domain code clean and DRY.
 * Returns Result<void, string> for consistent error handling.
 *
 * @example
 * ```typescript
 * const result = Guard.combine([
 *   Guard.againstNullOrUndefined(name, 'name'),
 *   Guard.againstEmpty(name, 'name'),
 *   Guard.inRange(age, 18, 120, 'age')
 * ])
 *
 * if (result.isFailure) {
 *   return Result.fail(new ValidationError(result.error))
 * }
 * ```
 */
import { Result } from './Result'

export interface GuardArgument {
  argument: unknown
  argumentName: string
}

export class Guard {
  /**
   * Check that value is not null or undefined
   */
  static againstNullOrUndefined(
    value: unknown,
    argumentName: string
  ): Result<void, string> {
    if (value === null || value === undefined) {
      return Result.fail(`${argumentName} is null or undefined`)
    }
    return Result.ok(undefined)
  }

  /**
   * Check that string is not empty
   */
  static againstEmpty(
    value: string,
    argumentName: string
  ): Result<void, string> {
    if (value.trim().length === 0) {
      return Result.fail(`${argumentName} is empty`)
    }
    return Result.ok(undefined)
  }

  /**
   * Check that number is in range (inclusive)
   */
  static inRange(
    value: number,
    min: number,
    max: number,
    argumentName: string
  ): Result<void, string> {
    if (value < min || value > max) {
      return Result.fail(
        `${argumentName} must be between ${min} and ${max}, got ${value}`
      )
    }
    return Result.ok(undefined)
  }

  /**
   * Check that string length is in range
   */
  static lengthInRange(
    value: string,
    minLength: number,
    maxLength: number,
    argumentName: string
  ): Result<void, string> {
    if (value.length < minLength || value.length > maxLength) {
      return Result.fail(
        `${argumentName} length must be between ${minLength} and ${maxLength}, got ${value.length}`
      )
    }
    return Result.ok(undefined)
  }

  /**
   * Check that value is greater than threshold
   */
  static greaterThan(
    value: number,
    min: number,
    argumentName: string
  ): Result<void, string> {
    if (value <= min) {
      return Result.fail(`${argumentName} must be greater than ${min}, got ${value}`)
    }
    return Result.ok(undefined)
  }

  /**
   * Check that array is not empty
   */
  static againstEmptyArray(
    value: unknown[],
    argumentName: string
  ): Result<void, string> {
    if (value.length === 0) {
      return Result.fail(`${argumentName} cannot be empty array`)
    }
    return Result.ok(undefined)
  }

  /**
   * Check that value matches regex pattern
   */
  static matchesPattern(
    value: string,
    pattern: RegExp,
    argumentName: string,
    errorMessage?: string
  ): Result<void, string> {
    if (!pattern.test(value)) {
      return Result.fail(
        errorMessage || `${argumentName} does not match required pattern`
      )
    }
    return Result.ok(undefined)
  }

  /**
   * Check that date is in future
   */
  static isInFuture(date: Date, argumentName: string): Result<void, string> {
    const now = new Date()
    if (date <= now) {
      return Result.fail(`${argumentName} must be in the future`)
    }
    return Result.ok(undefined)
  }

  /**
   * Check that date is in past
   */
  static isInPast(date: Date, argumentName: string): Result<void, string> {
    const now = new Date()
    if (date >= now) {
      return Result.fail(`${argumentName} must be in the past`)
    }
    return Result.ok(undefined)
  }

  /**
   * Combine multiple guard results - fails if any guard fails
   */
  static combine(guardResults: Result<void, string>[]): Result<void, string> {
    for (const result of guardResults) {
      if (result.isFailure) {
        return result
      }
    }
    return Result.ok(undefined)
  }

  /**
   * Combine multiple guard arguments for bulk null checks
   */
  static againstNullOrUndefinedBulk(
    args: GuardArgument[]
  ): Result<void, string> {
    const results = args.map((arg) =>
      Guard.againstNullOrUndefined(arg.argument, arg.argumentName)
    )
    return Guard.combine(results)
  }
}
