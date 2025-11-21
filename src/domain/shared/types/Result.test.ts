import { describe, it, expect } from 'vitest'
import { Result } from './Result'

describe('Result', () => {
  describe('ok', () => {
    it('should create a successful result with a value', () => {
      const result = Result.ok(42)

      expect(result.isSuccess).toBe(true)
      expect(result.isFailure).toBe(false)
      expect(result.value).toBe(42)
    })

    it('should accept null as a valid value', () => {
      const result = Result.ok(null)

      expect(result.isSuccess).toBe(true)
      expect(result.value).toBe(null)
    })
  })

  describe('fail', () => {
    it('should create a failed result with an error', () => {
      const error = new Error('Something went wrong')
      const result = Result.fail(error)

      expect(result.isSuccess).toBe(false)
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe(error)
    })

    it('should accept string errors', () => {
      const result = Result.fail<number, string>('Error message')

      expect(result.isFailure).toBe(true)
      expect(result.error).toBe('Error message')
    })
  })

  describe('value and error access', () => {
    it('should throw when accessing value on failed result', () => {
      const result = Result.fail(new Error('Failed'))

      expect(() => result.value).toThrow('Cannot get value from failed result')
    })

    it('should throw when accessing error on successful result', () => {
      const result = Result.ok(42)

      expect(() => result.error).toThrow('Cannot get error from successful result')
    })
  })

  describe('getOrElse', () => {
    it('should return value if successful', () => {
      const result = Result.ok(42)

      expect(result.getOrElse(0)).toBe(42)
    })

    it('should return default value if failed', () => {
      const result = Result.fail<number, Error>(new Error('Failed'))

      expect(result.getOrElse(0)).toBe(0)
    })
  })

  describe('map', () => {
    it('should map value if successful', () => {
      const result = Result.ok(42)
      const mapped = result.map((n) => n * 2)

      expect(mapped.isSuccess).toBe(true)
      expect(mapped.value).toBe(84)
    })

    it('should not map if failed', () => {
      const result = Result.fail<number, string>('Error')
      const mapped = result.map((n) => n * 2)

      expect(mapped.isFailure).toBe(true)
      expect(mapped.error).toBe('Error')
    })

    it('should allow changing value type', () => {
      const result = Result.ok(42)
      const mapped = result.map((n) => `Number: ${n}`)

      expect(mapped.isSuccess).toBe(true)
      expect(mapped.value).toBe('Number: 42')
    })
  })

  describe('flatMap', () => {
    it('should chain successful results', () => {
      const result = Result.ok(42)
      const chained = result.flatMap((n) => Result.ok(n * 2))

      expect(chained.isSuccess).toBe(true)
      expect(chained.value).toBe(84)
    })

    it('should propagate failure from inner result', () => {
      const result = Result.ok(42)
      const chained = result.flatMap(() => Result.fail<number, Error>(new Error('Inner error')))

      expect(chained.isFailure).toBe(true)
      expect(chained.error).toBeInstanceOf(Error)
      expect(chained.error.message).toBe('Inner error')
    })

    it('should not execute function if initial result is failed', () => {
      const result = Result.fail<number, string>('Initial error')
      let executed = false

      const chained = result.flatMap(() => {
        executed = true
        return Result.ok(84)
      })

      expect(chained.isFailure).toBe(true)
      expect(chained.error).toBe('Initial error')
      expect(executed).toBe(false)
    })
  })

  describe('mapError', () => {
    it('should map error if failed', () => {
      const result = Result.fail<number, string>('Original error')
      const mapped = result.mapError((err) => new Error(err))

      expect(mapped.isFailure).toBe(true)
      expect(mapped.error).toBeInstanceOf(Error)
      expect(mapped.error.message).toBe('Original error')
    })

    it('should not map if successful', () => {
      const result = Result.ok(42)
      const mapped = result.mapError((err) => new Error(String(err)))

      expect(mapped.isSuccess).toBe(true)
      expect(mapped.value).toBe(42)
    })
  })

  describe('combine', () => {
    it('should combine multiple successful results into array', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)]
      const combined = Result.combine(results)

      expect(combined.isSuccess).toBe(true)
      expect(combined.value).toEqual([1, 2, 3])
    })

    it('should fail if any result fails', () => {
      const results = [
        Result.ok(1),
        Result.fail<number, Error>(new Error('Error in second')),
        Result.ok(3),
      ]
      const combined = Result.combine(results)

      expect(combined.isFailure).toBe(true)
      expect(combined.error).toBeInstanceOf(Error)
      expect(combined.error.message).toBe('Error in second')
    })

    it('should return first error if multiple failures', () => {
      const results = [
        Result.ok(1),
        Result.fail<number, Error>(new Error('First error')),
        Result.fail<number, Error>(new Error('Second error')),
      ]
      const combined = Result.combine(results)

      expect(combined.isFailure).toBe(true)
      expect(combined.error).toBeInstanceOf(Error)
      expect(combined.error.message).toBe('First error')
    })

    it('should handle empty array', () => {
      const combined = Result.combine<number, string>([])

      expect(combined.isSuccess).toBe(true)
      expect(combined.value).toEqual([])
    })
  })

  describe('real-world scenario: validation pipeline', () => {
    it('should chain multiple validation steps', () => {
      // Simulate: validate email → check if exists → create user
      const validateEmail = (email: string): Result<string, string> => {
        return email.includes('@')
          ? Result.ok(email)
          : Result.fail('Invalid email')
      }

      const checkExists = (email: string): Result<string, string> => {
        return email === 'taken@test.com'
          ? Result.fail('Email already exists')
          : Result.ok(email)
      }

      const createUser = (email: string): Result<{ id: string; email: string }, string> => {
        return Result.ok({ id: '123', email })
      }

      // Happy path
      const result1 = validateEmail('new@test.com')
        .flatMap(checkExists)
        .flatMap(createUser)

      expect(result1.isSuccess).toBe(true)
      expect(result1.value).toEqual({ id: '123', email: 'new@test.com' })

      // Invalid email
      const result2 = validateEmail('invalid-email')
        .flatMap(checkExists)
        .flatMap(createUser)

      expect(result2.isFailure).toBe(true)
      expect(result2.error).toBe('Invalid email')

      // Email exists
      const result3 = validateEmail('taken@test.com')
        .flatMap(checkExists)
        .flatMap(createUser)

      expect(result3.isFailure).toBe(true)
      expect(result3.error).toBe('Email already exists')
    })
  })
})
