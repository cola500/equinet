import { describe, it, expect } from 'vitest'
import { BookingMapper } from './BookingMapper'
import { Booking } from './IBookingRepository'
import type { Booking as PrismaBooking } from '@prisma/client'

describe('BookingMapper', () => {
  const mapper = new BookingMapper()

  const prismaBooking: PrismaBooking = {
    id: 'booking-123',
    customerId: 'customer-456',
    providerId: 'provider-789',
    serviceId: 'service-001',
    routeOrderId: null,
    bookingDate: new Date('2025-01-15T00:00:00Z'),
    startTime: '10:00',
    endTime: '11:00',
    timezone: 'Europe/Stockholm',
    status: 'pending',
    horseId: null,
    horseName: 'Thunder',
    horseInfo: null,
    customerNotes: 'Test booking',
    travelTimeMinutes: null,
    isManualBooking: false,
    createdByProviderId: null,
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-02T12:00:00Z'),
  }

  const domainBooking: Booking = {
    id: 'booking-123',
    customerId: 'customer-456',
    providerId: 'provider-789',
    serviceId: 'service-001',
    bookingDate: new Date('2025-01-15T00:00:00Z'),
    startTime: '10:00',
    endTime: '11:00',
    timezone: 'Europe/Stockholm',
    status: 'pending',
    horseName: 'Thunder',
    notes: 'Test booking',
    isManualBooking: false,
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-02T12:00:00Z'),
  }

  describe('toDomain', () => {
    it('should map Prisma model to domain entity', () => {
      const result = mapper.toDomain(prismaBooking)

      expect(result).toEqual(domainBooking)
    })

    it('should handle null horseName', () => {
      const prisma = { ...prismaBooking, horseName: null }

      const result = mapper.toDomain(prisma)

      expect(result.horseName).toBeUndefined()
    })

    it('should handle null notes', () => {
      const prisma = { ...prismaBooking, customerNotes: null }

      const result = mapper.toDomain(prisma)

      expect(result.notes).toBeUndefined()
    })

    it('should preserve all booking statuses', () => {
      const statuses: PrismaBooking['status'][] = [
        'pending',
        'confirmed',
        'cancelled',
        'completed',
      ]

      statuses.forEach((status) => {
        const prisma = { ...prismaBooking, status }
        const result = mapper.toDomain(prisma)

        expect(result.status).toBe(status)
      })
    })
  })

  describe('toPersistence', () => {
    it('should map domain entity to Prisma model', () => {
      const result = mapper.toPersistence(domainBooking)

      expect(result).toEqual(prismaBooking)
    })

    it('should handle undefined horseName', () => {
      const domain = { ...domainBooking, horseName: undefined }

      const result = mapper.toPersistence(domain)

      expect(result.horseName).toBeNull()
    })

    it('should handle undefined notes', () => {
      const domain = { ...domainBooking, notes: undefined }

      const result = mapper.toPersistence(domain)

      expect(result.customerNotes).toBeNull()
    })
  })

  describe('toDomainList', () => {
    it('should map array of Prisma models to domain entities', () => {
      const prisma1 = { ...prismaBooking, id: 'booking-1' }
      const prisma2 = { ...prismaBooking, id: 'booking-2' }

      const result = mapper.toDomainList([prisma1, prisma2])

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('booking-1')
      expect(result[1].id).toBe('booking-2')
    })

    it('should handle empty array', () => {
      const result = mapper.toDomainList([])

      expect(result).toEqual([])
    })
  })

  describe('toPersistenceList', () => {
    it('should map array of domain entities to Prisma models', () => {
      const domain1 = { ...domainBooking, id: 'booking-1' }
      const domain2 = { ...domainBooking, id: 'booking-2' }

      const result = mapper.toPersistenceList([domain1, domain2])

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('booking-1')
      expect(result[1].id).toBe('booking-2')
    })

    it('should handle empty array', () => {
      const result = mapper.toPersistenceList([])

      expect(result).toEqual([])
    })
  })

  describe('bidirectional mapping', () => {
    it('should maintain data integrity through round-trip conversion', () => {
      const original = prismaBooking

      // Prisma → Domain → Prisma
      const domain = mapper.toDomain(original)
      const backToPrisma = mapper.toPersistence(domain)

      expect(backToPrisma).toEqual(original)
    })

    it('should maintain domain entity through round-trip conversion', () => {
      const original = domainBooking

      // Domain → Prisma → Domain
      const prisma = mapper.toPersistence(original)
      const backToDomain = mapper.toDomain(prisma)

      expect(backToDomain).toEqual(original)
    })
  })

  describe('real-world scenario: booking lifecycle', () => {
    it('should correctly map booking state changes', () => {
      // Start with pending booking
      const pendingPrisma = { ...prismaBooking, status: 'pending' as const }
      const pendingDomain = mapper.toDomain(pendingPrisma)

      expect(pendingDomain.status).toBe('pending')

      // Confirm booking
      const confirmedDomain = { ...pendingDomain, status: 'confirmed' as const }
      const confirmedPrisma = mapper.toPersistence(confirmedDomain)

      expect(confirmedPrisma.status).toBe('confirmed')

      // Complete booking
      const completedDomain = { ...confirmedDomain, status: 'completed' as const }
      const completedPrisma = mapper.toPersistence(completedDomain)

      expect(completedPrisma.status).toBe('completed')
    })

    it('should handle optional fields during updates', () => {
      // Booking without horse name
      const withoutHorse = { ...prismaBooking, horseName: null }
      const domain1 = mapper.toDomain(withoutHorse)

      expect(domain1.horseName).toBeUndefined()

      // Add horse name
      const withHorse = { ...domain1, horseName: 'Thunder' }
      const prisma = mapper.toPersistence(withHorse)

      expect(prisma.horseName).toBe('Thunder')
    })
  })
})
