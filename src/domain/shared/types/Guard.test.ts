import { describe, it, expect } from 'vitest'
import { Guard } from './Guard'

describe('Guard', () => {
  describe('againstNullOrUndefined', () => {
    it('should pass for valid values', () => {
      const result = Guard.againstNullOrUndefined('test', 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for null', () => {
      const result = Guard.againstNullOrUndefined(null, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value is null or undefined')
    })

    it('should fail for undefined', () => {
      const result = Guard.againstNullOrUndefined(undefined, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value is null or undefined')
    })

    it('should accept 0 as valid', () => {
      const result = Guard.againstNullOrUndefined(0, 'number')
      expect(result.isSuccess).toBe(true)
    })

    it('should accept empty string as valid', () => {
      const result = Guard.againstNullOrUndefined('', 'string')
      expect(result.isSuccess).toBe(true)
    })

    it('should accept false as valid', () => {
      const result = Guard.againstNullOrUndefined(false, 'boolean')
      expect(result.isSuccess).toBe(true)
    })
  })

  describe('againstEmpty', () => {
    it('should pass for non-empty strings', () => {
      const result = Guard.againstEmpty('test', 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for empty string', () => {
      const result = Guard.againstEmpty('', 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value is empty')
    })

    it('should fail for whitespace-only string', () => {
      const result = Guard.againstEmpty('   ', 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value is empty')
    })
  })

  describe('inRange', () => {
    it('should pass for value in range', () => {
      const result = Guard.inRange(5, 1, 10, 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should pass for value at min boundary', () => {
      const result = Guard.inRange(1, 1, 10, 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should pass for value at max boundary', () => {
      const result = Guard.inRange(10, 1, 10, 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for value below min', () => {
      const result = Guard.inRange(0, 1, 10, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value must be between 1 and 10, got 0')
    })

    it('should fail for value above max', () => {
      const result = Guard.inRange(11, 1, 10, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value must be between 1 and 10, got 11')
    })
  })

  describe('lengthInRange', () => {
    it('should pass for length in range', () => {
      const result = Guard.lengthInRange('hello', 1, 10, 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for length below min', () => {
      const result = Guard.lengthInRange('hi', 3, 10, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value length must be between 3 and 10, got 2')
    })

    it('should fail for length above max', () => {
      const result = Guard.lengthInRange('hello world!!!', 1, 10, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value length must be between 1 and 10, got 14')
    })
  })

  describe('greaterThan', () => {
    it('should pass for value greater than threshold', () => {
      const result = Guard.greaterThan(10, 5, 'value')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for value equal to threshold', () => {
      const result = Guard.greaterThan(5, 5, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value must be greater than 5, got 5')
    })

    it('should fail for value less than threshold', () => {
      const result = Guard.greaterThan(3, 5, 'value')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('value must be greater than 5, got 3')
    })
  })

  describe('againstEmptyArray', () => {
    it('should pass for non-empty array', () => {
      const result = Guard.againstEmptyArray([1, 2, 3], 'items')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for empty array', () => {
      const result = Guard.againstEmptyArray([], 'items')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('items cannot be empty array')
    })
  })

  describe('matchesPattern', () => {
    it('should pass for matching pattern', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const result = Guard.matchesPattern('test@example.com', emailPattern, 'email')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for non-matching pattern', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const result = Guard.matchesPattern('invalid-email', emailPattern, 'email')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('email does not match required pattern')
    })

    it('should use custom error message', () => {
      const phonePattern = /^\d{3}-\d{3}-\d{4}$/
      const result = Guard.matchesPattern(
        '123456',
        phonePattern,
        'phone',
        'Phone must be in format XXX-XXX-XXXX'
      )
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('Phone must be in format XXX-XXX-XXXX')
    })
  })

  describe('isInFuture', () => {
    it('should pass for future date', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
      const result = Guard.isInFuture(futureDate, 'date')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for past date', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      const result = Guard.isInFuture(pastDate, 'date')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('date must be in the future')
    })

    it('should fail for current date (technically in past)', () => {
      const now = new Date()
      const result = Guard.isInFuture(now, 'date')
      expect(result.isFailure).toBe(true)
    })
  })

  describe('isInPast', () => {
    it('should pass for past date', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      const result = Guard.isInPast(pastDate, 'date')
      expect(result.isSuccess).toBe(true)
    })

    it('should fail for future date', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
      const result = Guard.isInPast(futureDate, 'date')
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('date must be in the past')
    })
  })

  describe('combine', () => {
    it('should pass if all guards pass', () => {
      const guards = [
        Guard.againstNullOrUndefined('test', 'value'),
        Guard.againstEmpty('test', 'value'),
        Guard.lengthInRange('test', 1, 10, 'value'),
      ]
      const result = Guard.combine(guards)
      expect(result.isSuccess).toBe(true)
    })

    it('should fail if any guard fails', () => {
      const guards = [
        Guard.againstNullOrUndefined('test', 'value'),
        Guard.againstEmpty('', 'empty'), // This will fail
        Guard.lengthInRange('test', 1, 10, 'value'),
      ]
      const result = Guard.combine(guards)
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('empty is empty')
    })

    it('should return first error when multiple guards fail', () => {
      const guards = [
        Guard.againstNullOrUndefined(null, 'first'), // Fails first
        Guard.againstEmpty('', 'second'), // Would also fail
      ]
      const result = Guard.combine(guards)
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('first is null or undefined')
    })
  })

  describe('againstNullOrUndefinedBulk', () => {
    it('should pass if all arguments are valid', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 'test', argumentName: 'name' },
        { argument: 123, argumentName: 'age' },
        { argument: true, argumentName: 'active' },
      ])
      expect(result.isSuccess).toBe(true)
    })

    it('should fail if any argument is null', () => {
      const result = Guard.againstNullOrUndefinedBulk([
        { argument: 'test', argumentName: 'name' },
        { argument: null, argumentName: 'age' },
        { argument: true, argumentName: 'active' },
      ])
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('age is null or undefined')
    })
  })

  describe('real-world scenario: booking validation', () => {
    it('should validate booking data with multiple guards', () => {
      const customerId = '123'
      const serviceId = '456'
      const date = new Date(Date.now() + 1000 * 60 * 60 * 24) // Tomorrow
      const horseName = 'Thunder'

      const validationResult = Guard.combine([
        Guard.againstNullOrUndefined(customerId, 'customerId'),
        Guard.againstNullOrUndefined(serviceId, 'serviceId'),
        Guard.againstNullOrUndefined(horseName, 'horseName'),
        Guard.againstEmpty(horseName, 'horseName'),
        Guard.lengthInRange(horseName, 1, 50, 'horseName'),
        Guard.isInFuture(date, 'bookingDate'),
      ])

      expect(validationResult.isSuccess).toBe(true)
    })

    it('should catch invalid booking data', () => {
      const date = new Date(Date.now() - 1000 * 60 * 60) // Past date
      const horseName = '' // Empty

      const validationResult = Guard.combine([
        Guard.againstEmpty(horseName, 'horseName'),
        Guard.isInFuture(date, 'bookingDate'),
      ])

      expect(validationResult.isFailure).toBe(true)
      expect(validationResult.error).toBe('horseName is empty')
    })
  })
})
