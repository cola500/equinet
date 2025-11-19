import { describe, it, expect } from 'vitest'
import { ValueObject } from './ValueObject'

// Test value object implementations
interface AddressProps {
  street: string
  city: string
  zipCode: string
}

class Address extends ValueObject<AddressProps> {
  get street() {
    return this.props.street
  }

  get city() {
    return this.props.city
  }

  get zipCode() {
    return this.props.zipCode
  }
}

interface TimeSlotProps {
  startTime: string
  endTime: string
}

class TimeSlot extends ValueObject<TimeSlotProps> {
  get startTime() {
    return this.props.startTime
  }

  get endTime() {
    return this.props.endTime
  }
}

describe('ValueObject', () => {
  describe('immutability', () => {
    it('should freeze properties on creation', () => {
      const address = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      // Attempting to modify should throw in strict mode or be silently ignored
      expect(() => {
        // @ts-expect-error Testing immutability
        address.props.city = 'Gothenburg'
      }).toThrow()
    })

    it('should prevent adding new properties', () => {
      const address = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      expect(() => {
        // @ts-expect-error Testing immutability
        address.props.country = 'Sweden'
      }).toThrow()
    })
  })

  describe('equals', () => {
    it('should return true for same value object instance', () => {
      const address = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      expect(address.equals(address)).toBe(true)
    })

    it('should return true for value objects with same properties', () => {
      const address1 = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      const address2 = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      expect(address1.equals(address2)).toBe(true)
    })

    it('should return false for value objects with different properties', () => {
      const address1 = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      const address2 = new Address({
        street: '456 Other St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      expect(address1.equals(address2)).toBe(false)
    })

    it('should return false for undefined', () => {
      const address = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      expect(address.equals(undefined)).toBe(false)
    })

    it('should return false for non-ValueObject', () => {
      const address = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      // @ts-expect-error Testing type safety
      expect(address.equals({ street: '123 Main St' })).toBe(false)
    })
  })

  describe('equals with nested objects', () => {
    interface PersonProps {
      name: string
      address: AddressProps
    }

    class Person extends ValueObject<PersonProps> {
      get name() {
        return this.props.name
      }

      get address() {
        return this.props.address
      }
    }

    it('should deeply compare nested objects', () => {
      const person1 = new Person({
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Stockholm',
          zipCode: '12345',
        },
      })

      const person2 = new Person({
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Stockholm',
          zipCode: '12345',
        },
      })

      expect(person1.equals(person2)).toBe(true)
    })

    it('should detect differences in nested objects', () => {
      const person1 = new Person({
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Stockholm',
          zipCode: '12345',
        },
      })

      const person2 = new Person({
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Gothenburg', // Different city
          zipCode: '12345',
        },
      })

      expect(person1.equals(person2)).toBe(false)
    })
  })

  describe('equals with Date objects', () => {
    interface EventProps {
      name: string
      date: Date
    }

    class Event extends ValueObject<EventProps> {
      get name() {
        return this.props.name
      }

      get date() {
        return this.props.date
      }
    }

    it('should compare Date objects by value', () => {
      const date1 = new Date('2025-01-01T12:00:00Z')
      const date2 = new Date('2025-01-01T12:00:00Z')

      const event1 = new Event({ name: 'Meeting', date: date1 })
      const event2 = new Event({ name: 'Meeting', date: date2 })

      expect(event1.equals(event2)).toBe(true)
    })

    it('should detect different Date values', () => {
      const event1 = new Event({
        name: 'Meeting',
        date: new Date('2025-01-01T12:00:00Z'),
      })

      const event2 = new Event({
        name: 'Meeting',
        date: new Date('2025-01-02T12:00:00Z'),
      })

      expect(event1.equals(event2)).toBe(false)
    })
  })

  describe('toJSON', () => {
    it('should serialize value object to plain object', () => {
      const address = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      const json = address.toJSON()

      expect(json).toEqual({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })
      expect(json).not.toBe(address.props) // Should be a copy
    })

    it('should handle nested objects in serialization', () => {
      interface PersonProps {
        name: string
        address: AddressProps
      }

      class Person extends ValueObject<PersonProps> {}

      const person = new Person({
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Stockholm',
          zipCode: '12345',
        },
      })

      const json = person.toJSON()

      expect(json).toEqual({
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'Stockholm',
          zipCode: '12345',
        },
      })
    })
  })

  describe('real-world scenario: time slot overlap detection', () => {
    class TimeSlotWithLogic extends ValueObject<TimeSlotProps> {
      get startTime() {
        return this.props.startTime
      }

      get endTime() {
        return this.props.endTime
      }

      overlaps(other: TimeSlotWithLogic): boolean {
        const start1 = this.parseTime(this.startTime)
        const end1 = this.parseTime(this.endTime)
        const start2 = this.parseTime(other.startTime)
        const end2 = this.parseTime(other.endTime)

        return start1 < end2 && start2 < end1
      }

      private parseTime(time: string): number {
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + minutes
      }
    }

    it('should detect overlapping time slots', () => {
      const slot1 = new TimeSlotWithLogic({
        startTime: '10:00',
        endTime: '11:00',
      })

      const slot2 = new TimeSlotWithLogic({
        startTime: '10:30',
        endTime: '11:30',
      })

      expect(slot1.overlaps(slot2)).toBe(true)
      expect(slot2.overlaps(slot1)).toBe(true)
    })

    it('should not detect non-overlapping time slots', () => {
      const slot1 = new TimeSlotWithLogic({
        startTime: '10:00',
        endTime: '11:00',
      })

      const slot2 = new TimeSlotWithLogic({
        startTime: '11:00',
        endTime: '12:00',
      })

      expect(slot1.overlaps(slot2)).toBe(false)
    })

    it('should treat identical time slots as equal value objects', () => {
      const slot1 = new TimeSlotWithLogic({
        startTime: '10:00',
        endTime: '11:00',
      })

      const slot2 = new TimeSlotWithLogic({
        startTime: '10:00',
        endTime: '11:00',
      })

      expect(slot1.equals(slot2)).toBe(true)
    })
  })

  describe('real-world scenario: address validation', () => {
    it('should use value objects for address comparison', () => {
      // Same address, different instances
      const homeAddress = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      const deliveryAddress = new Address({
        street: '123 Main St',
        city: 'Stockholm',
        zipCode: '12345',
      })

      // Should be considered equal for business logic
      expect(homeAddress.equals(deliveryAddress)).toBe(true)

      // But work address is different
      const workAddress = new Address({
        street: '456 Business Blvd',
        city: 'Stockholm',
        zipCode: '12345',
      })

      expect(homeAddress.equals(workAddress)).toBe(false)
    })
  })
})
