import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  InvalidOperationError,
} from './DomainError'

describe('DomainError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('base DomainError', () => {
    class CustomDomainError extends DomainError {
      constructor(message: string) {
        super(message, 'CUSTOM_ERROR')
      }
    }

    it('should create error with message and code', () => {
      const error = new CustomDomainError('Something went wrong')

      expect(error.message).toBe('Something went wrong')
      expect(error.code).toBe('CUSTOM_ERROR')
      expect(error.name).toBe('CustomDomainError')
    })

    it('should capture timestamp', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const error = new CustomDomainError('Test error')

      expect(error.timestamp).toEqual(now)
    })

    it('should be instanceof Error', () => {
      const error = new CustomDomainError('Test error')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(DomainError)
    })

    it('should have stack trace', () => {
      const error = new CustomDomainError('Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('CustomDomainError')
    })

    it('should serialize to JSON', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const error = new CustomDomainError('Test error')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'CustomDomainError',
        message: 'Test error',
        code: 'CUSTOM_ERROR',
        timestamp: '2025-01-01T12:00:00.000Z',
      })
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with message', () => {
      const error = new ValidationError('Name is required')

      expect(error.message).toBe('Name is required')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.name).toBe('ValidationError')
    })

    it('should store field name', () => {
      const error = new ValidationError('Invalid email format', 'email')

      expect(error.field).toBe('email')
    })

    it('should serialize with field in JSON', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const error = new ValidationError('Invalid email', 'email')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ValidationError',
        message: 'Invalid email',
        code: 'VALIDATION_ERROR',
        timestamp: '2025-01-01T12:00:00.000Z',
        field: 'email',
      })
    })

    it('should handle missing field', () => {
      const error = new ValidationError('General validation error')

      expect(error.field).toBeUndefined()
    })
  })

  describe('NotFoundError', () => {
    it('should create not found error with entity name and id', () => {
      const error = new NotFoundError('Booking', '123')

      expect(error.message).toBe('Booking with id 123 not found')
      expect(error.code).toBe('NOT_FOUND')
      expect(error.name).toBe('NotFoundError')
    })

    it('should work with different entity types', () => {
      const bookingError = new NotFoundError('Booking', 'booking-123')
      const providerError = new NotFoundError('Provider', 'provider-456')

      expect(bookingError.message).toContain('Booking')
      expect(providerError.message).toContain('Provider')
    })
  })

  describe('ConflictError', () => {
    it('should create conflict error with message', () => {
      const error = new ConflictError('Booking time slot already taken')

      expect(error.message).toBe('Booking time slot already taken')
      expect(error.code).toBe('CONFLICT')
      expect(error.name).toBe('ConflictError')
    })
  })

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with default message', () => {
      const error = new UnauthorizedError()

      expect(error.message).toBe('Unauthorized access')
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.name).toBe('UnauthorizedError')
    })

    it('should accept custom message', () => {
      const error = new UnauthorizedError('You cannot access this booking')

      expect(error.message).toBe('You cannot access this booking')
    })
  })

  describe('InvalidOperationError', () => {
    it('should create invalid operation error with message', () => {
      const error = new InvalidOperationError('Cannot cancel completed booking')

      expect(error.message).toBe('Cannot cancel completed booking')
      expect(error.code).toBe('INVALID_OPERATION')
      expect(error.name).toBe('InvalidOperationError')
    })
  })

  describe('real-world scenario: booking domain errors', () => {
    class BookingOverlapError extends DomainError {
      constructor(
        public readonly conflictingBookingId: string,
        public readonly timeSlot: string
      ) {
        super(
          `Time slot ${timeSlot} overlaps with booking ${conflictingBookingId}`,
          'BOOKING_OVERLAP'
        )
      }

      toJSON() {
        return {
          ...super.toJSON(),
          conflictingBookingId: this.conflictingBookingId,
          timeSlot: this.timeSlot,
        }
      }
    }

    it('should create custom domain error with business context', () => {
      const error = new BookingOverlapError('booking-456', '10:00-11:00')

      expect(error.message).toBe(
        'Time slot 10:00-11:00 overlaps with booking booking-456'
      )
      expect(error.code).toBe('BOOKING_OVERLAP')
      expect(error.conflictingBookingId).toBe('booking-456')
      expect(error.timeSlot).toBe('10:00-11:00')
    })

    it('should serialize custom error with extra fields', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const error = new BookingOverlapError('booking-456', '10:00-11:00')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'BookingOverlapError',
        message: 'Time slot 10:00-11:00 overlaps with booking booking-456',
        code: 'BOOKING_OVERLAP',
        timestamp: '2025-01-01T12:00:00.000Z',
        conflictingBookingId: 'booking-456',
        timeSlot: '10:00-11:00',
      })
    })
  })

  describe('error handling in API responses', () => {
    it('should differentiate between error types for proper HTTP status codes', () => {
      const validationError = new ValidationError('Invalid input', 'email')
      const notFoundError = new NotFoundError('Booking', '123')
      const unauthorizedError = new UnauthorizedError()
      const conflictError = new ConflictError('Resource conflict')

      // These errors would map to:
      expect(validationError.code).toBe('VALIDATION_ERROR') // HTTP 400
      expect(notFoundError.code).toBe('NOT_FOUND') // HTTP 404
      expect(unauthorizedError.code).toBe('UNAUTHORIZED') // HTTP 401
      expect(conflictError.code).toBe('CONFLICT') // HTTP 409
    })

    it('should provide JSON serialization for API responses', () => {
      const error = new ValidationError('Email is required', 'email')
      const json = error.toJSON()

      // This JSON can be sent directly in API response
      expect(json).toHaveProperty('name')
      expect(json).toHaveProperty('message')
      expect(json).toHaveProperty('code')
      expect(json).toHaveProperty('timestamp')
      expect(json).toHaveProperty('field')
    })
  })

  describe('error code consistency', () => {
    it('should have unique error codes for different error types', () => {
      const errors = [
        new ValidationError('test'),
        new NotFoundError('Entity', '1'),
        new ConflictError('test'),
        new UnauthorizedError(),
        new InvalidOperationError('test'),
      ]

      const codes = errors.map((e) => e.code)
      const uniqueCodes = new Set(codes)

      expect(uniqueCodes.size).toBe(codes.length)
    })
  })
})
