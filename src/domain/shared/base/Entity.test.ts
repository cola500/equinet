import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Entity, EntityProps } from './Entity'

// Test entity implementation
interface TestEntityProps extends EntityProps {
  name: string
  value: number
}

class TestEntity extends Entity<TestEntityProps> {
  get name() {
    return this.props.name
  }

  get value() {
    return this.props.value
  }

  updateValue(newValue: number) {
    this.props.value = newValue
    this.touch()
  }

  createClone(newValue: number): TestEntity {
    return this.clone({ value: newValue })
  }
}

describe('Entity', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create entity with provided properties', () => {
      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      expect(entity.id).toBe('123')
      expect(entity.name).toBe('test')
      expect(entity.value).toBe(42)
    })

    it('should set createdAt if not provided', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      expect(entity.createdAt).toEqual(now)
    })

    it('should preserve createdAt if provided', () => {
      const createdAt = new Date('2024-01-01T12:00:00Z')
      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
        createdAt,
      })

      expect(entity.createdAt).toEqual(createdAt)
    })

    it('should set updatedAt if not provided', () => {
      const now = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      expect(entity.updatedAt).toEqual(now)
    })
  })

  describe('equals', () => {
    it('should return true for same entity instance', () => {
      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      expect(entity.equals(entity)).toBe(true)
    })

    it('should return true for entities with same ID', () => {
      const entity1 = new TestEntity({
        id: '123',
        name: 'test1',
        value: 42,
      })

      const entity2 = new TestEntity({
        id: '123',
        name: 'test2', // Different properties
        value: 100,
      })

      expect(entity1.equals(entity2)).toBe(true)
    })

    it('should return false for entities with different IDs', () => {
      const entity1 = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      const entity2 = new TestEntity({
        id: '456',
        name: 'test', // Same properties
        value: 42,
      })

      expect(entity1.equals(entity2)).toBe(false)
    })

    it('should return false for undefined entity', () => {
      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      expect(entity.equals(undefined)).toBe(false)
    })

    it('should return false for null', () => {
      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      expect(entity.equals(null as any)).toBe(false)
    })

    it('should return false for non-Entity objects', () => {
      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      // @ts-expect-error Testing type safety
      expect(entity.equals({ id: '123' })).toBe(false)
    })
  })

  describe('touch', () => {
    it('should update updatedAt when entity is modified', () => {
      const createdTime = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(createdTime)

      const entity = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      const originalUpdatedAt = entity.updatedAt

      // Advance time
      const modifiedTime = new Date('2025-01-01T13:00:00Z')
      vi.setSystemTime(modifiedTime)

      entity.updateValue(100)

      expect(entity.updatedAt).toEqual(modifiedTime)
      expect(entity.updatedAt).not.toEqual(originalUpdatedAt)
    })
  })

  describe('clone', () => {
    it('should create new entity instance with updated properties', () => {
      const createdTime = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(createdTime)

      const original = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      const cloneTime = new Date('2025-01-01T13:00:00Z')
      vi.setSystemTime(cloneTime)

      const cloned = original.createClone(100)

      expect(cloned.id).toBe(original.id)
      expect(cloned.name).toBe(original.name)
      expect(cloned.value).toBe(100)
      expect(cloned.updatedAt).toEqual(cloneTime)
      expect(cloned).not.toBe(original) // Different instances
    })

    it('should preserve createdAt when cloning', () => {
      const createdTime = new Date('2025-01-01T12:00:00Z')
      vi.setSystemTime(createdTime)

      const original = new TestEntity({
        id: '123',
        name: 'test',
        value: 42,
      })

      vi.setSystemTime(new Date('2025-01-02T12:00:00Z'))

      const cloned = original.createClone(100)

      expect(cloned.createdAt).toEqual(original.createdAt)
    })
  })

  describe('real-world scenario: booking entity lifecycle', () => {
    interface BookingProps extends EntityProps {
      customerId: string
      status: 'pending' | 'confirmed' | 'cancelled'
    }

    class Booking extends Entity<BookingProps> {
      get customerId() {
        return this.props.customerId
      }

      get status() {
        return this.props.status
      }

      confirm() {
        if (this.props.status === 'cancelled') {
          throw new Error('Cannot confirm cancelled booking')
        }
        this.props.status = 'confirmed'
        this.touch()
      }

      cancel() {
        this.props.status = 'cancelled'
        this.touch()
      }
    }

    it('should track booking lifecycle with timestamps', () => {
      const createdTime = new Date('2025-01-01T10:00:00Z')
      vi.setSystemTime(createdTime)

      const booking = new Booking({
        id: 'booking-123',
        customerId: 'customer-456',
        status: 'pending',
      })

      expect(booking.status).toBe('pending')
      expect(booking.createdAt).toEqual(createdTime)

      // Confirm booking 1 hour later
      const confirmTime = new Date('2025-01-01T11:00:00Z')
      vi.setSystemTime(confirmTime)
      booking.confirm()

      expect(booking.status).toBe('confirmed')
      expect(booking.updatedAt).toEqual(confirmTime)
      expect(booking.createdAt).toEqual(createdTime) // Unchanged
    })

    it('should maintain identity across status changes', () => {
      const booking = new Booking({
        id: 'booking-123',
        customerId: 'customer-456',
        status: 'pending',
      })

      const originalBooking = booking

      booking.confirm()

      expect(booking.equals(originalBooking)).toBe(true)
      expect(booking).toBe(originalBooking) // Same instance
    })
  })
})
