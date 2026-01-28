import { describe, it, expect, beforeEach } from 'vitest'
import { MockBookingRepository } from './MockBookingRepository'
import { Booking } from './IBookingRepository'

describe('MockBookingRepository', () => {
  let repository: MockBookingRepository

  const createBooking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 'booking-123',
    customerId: 'customer-456',
    providerId: 'provider-789',
    serviceId: 'service-001',
    bookingDate: new Date('2025-01-15'),
    startTime: '10:00',
    endTime: '11:00',
    timezone: 'Europe/Stockholm',
    status: 'pending',
    horseName: 'Thunder',
    notes: 'Test booking',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    repository = new MockBookingRepository()
  })

  describe('findById', () => {
    it('should return booking by id', async () => {
      const booking = createBooking()
      await repository.save(booking)

      const found = await repository.findById('booking-123')

      expect(found).toEqual(booking)
    })

    it('should return null when booking not found', async () => {
      const found = await repository.findById('non-existent')

      expect(found).toBeNull()
    })
  })

  describe('findMany', () => {
    it('should return all bookings when no criteria', async () => {
      const booking1 = createBooking({ id: 'booking-1' })
      const booking2 = createBooking({ id: 'booking-2' })

      await repository.save(booking1)
      await repository.save(booking2)

      const results = await repository.findMany()

      expect(results).toHaveLength(2)
    })

    it('should filter by criteria', async () => {
      await repository.save(createBooking({ id: 'booking-1', status: 'pending' }))
      await repository.save(createBooking({ id: 'booking-2', status: 'confirmed' }))

      const results = await repository.findMany({ status: 'confirmed' })

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('confirmed')
    })

    it('should sort by bookingDate descending', async () => {
      await repository.save(
        createBooking({
          id: 'booking-1',
          bookingDate: new Date('2025-01-10'),
        })
      )
      await repository.save(
        createBooking({
          id: 'booking-2',
          bookingDate: new Date('2025-01-20'),
        })
      )

      const results = await repository.findMany()

      expect(results[0].id).toBe('booking-2') // Most recent first
      expect(results[1].id).toBe('booking-1')
    })
  })

  describe('save', () => {
    it('should save new booking', async () => {
      const booking = createBooking()

      const saved = await repository.save(booking)

      expect(saved).toEqual(booking)
      const found = await repository.findById('booking-123')
      expect(found).toEqual(booking)
    })

    it('should update existing booking', async () => {
      const booking = createBooking()
      await repository.save(booking)

      const updated = { ...booking, status: 'confirmed' as const }
      await repository.save(updated)

      const found = await repository.findById('booking-123')
      expect(found?.status).toBe('confirmed')
    })
  })

  describe('delete', () => {
    it('should delete booking by id', async () => {
      const booking = createBooking()
      await repository.save(booking)

      await repository.delete('booking-123')

      const found = await repository.findById('booking-123')
      expect(found).toBeNull()
    })

    it('should not throw when deleting non-existent booking', async () => {
      await expect(repository.delete('non-existent')).resolves.not.toThrow()
    })
  })

  describe('exists', () => {
    it('should return true when booking exists', async () => {
      const booking = createBooking()
      await repository.save(booking)

      const exists = await repository.exists('booking-123')

      expect(exists).toBe(true)
    })

    it('should return false when booking does not exist', async () => {
      const exists = await repository.exists('non-existent')

      expect(exists).toBe(false)
    })
  })

  describe('findByCustomerId', () => {
    it('should return all bookings for a customer', async () => {
      await repository.save(
        createBooking({ id: 'booking-1', customerId: 'customer-1' })
      )
      await repository.save(
        createBooking({ id: 'booking-2', customerId: 'customer-1' })
      )
      await repository.save(
        createBooking({ id: 'booking-3', customerId: 'customer-2' })
      )

      const results = await repository.findByCustomerId('customer-1')

      expect(results).toHaveLength(2)
      expect(results.every((b) => b.customerId === 'customer-1')).toBe(true)
    })

    it('should return empty array when no bookings found', async () => {
      const results = await repository.findByCustomerId('non-existent')

      expect(results).toEqual([])
    })
  })

  describe('findByProviderId', () => {
    it('should return all bookings for a provider', async () => {
      await repository.save(
        createBooking({ id: 'booking-1', providerId: 'provider-1' })
      )
      await repository.save(
        createBooking({ id: 'booking-2', providerId: 'provider-1' })
      )
      await repository.save(
        createBooking({ id: 'booking-3', providerId: 'provider-2' })
      )

      const results = await repository.findByProviderId('provider-1')

      expect(results).toHaveLength(2)
      expect(results.every((b) => b.providerId === 'provider-1')).toBe(true)
    })
  })

  describe('findOverlapping', () => {
    it('should find bookings that overlap with time slot', async () => {
      const date = new Date('2025-01-15')

      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      const overlapping = await repository.findOverlapping(
        'provider-1',
        date,
        '10:30',
        '11:30'
      )

      expect(overlapping).toHaveLength(1)
      expect(overlapping[0].id).toBe('booking-1')
    })

    it('should not find non-overlapping bookings', async () => {
      const date = new Date('2025-01-15')

      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      const overlapping = await repository.findOverlapping(
        'provider-1',
        date,
        '11:00',
        '12:00'
      )

      expect(overlapping).toHaveLength(0)
    })

    it('should only include active bookings (pending/confirmed)', async () => {
      const date = new Date('2025-01-15')

      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '10:00',
          endTime: '11:00',
          status: 'cancelled', // Should be excluded
        })
      )

      const overlapping = await repository.findOverlapping(
        'provider-1',
        date,
        '10:30',
        '11:30'
      )

      expect(overlapping).toHaveLength(0)
    })

    it('should filter by provider', async () => {
      const date = new Date('2025-01-15')

      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      await repository.save(
        createBooking({
          id: 'booking-2',
          providerId: 'provider-2',
          bookingDate: date,
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      const overlapping = await repository.findOverlapping(
        'provider-1',
        date,
        '10:30',
        '11:30'
      )

      expect(overlapping).toHaveLength(1)
      expect(overlapping[0].providerId).toBe('provider-1')
    })

    it('should filter by date', async () => {
      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: new Date('2025-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      const overlapping = await repository.findOverlapping(
        'provider-1',
        new Date('2025-01-16'), // Different date
        '10:30',
        '11:30'
      )

      expect(overlapping).toHaveLength(0)
    })
  })

  describe('findByStatus', () => {
    it('should return bookings with specific status', async () => {
      await repository.save(createBooking({ id: 'booking-1', status: 'pending' }))
      await repository.save(createBooking({ id: 'booking-2', status: 'confirmed' }))
      await repository.save(createBooking({ id: 'booking-3', status: 'confirmed' }))

      const results = await repository.findByStatus('confirmed')

      expect(results).toHaveLength(2)
      expect(results.every((b) => b.status === 'confirmed')).toBe(true)
    })
  })

  describe('findByProviderAndDate', () => {
    it('should return bookings for provider on specific date', async () => {
      const date = new Date('2025-01-15')

      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '10:00',
        })
      )

      await repository.save(
        createBooking({
          id: 'booking-2',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '14:00',
        })
      )

      await repository.save(
        createBooking({
          id: 'booking-3',
          providerId: 'provider-1',
          bookingDate: new Date('2025-01-16'),
        })
      )

      const results = await repository.findByProviderAndDate('provider-1', date)

      expect(results).toHaveLength(2)
      expect(results[0].startTime).toBe('10:00')
      expect(results[1].startTime).toBe('14:00')
    })

    it('should sort by startTime ascending', async () => {
      const date = new Date('2025-01-15')

      await repository.save(
        createBooking({
          id: 'booking-1',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '14:00',
        })
      )

      await repository.save(
        createBooking({
          id: 'booking-2',
          providerId: 'provider-1',
          bookingDate: date,
          startTime: '10:00',
        })
      )

      const results = await repository.findByProviderAndDate('provider-1', date)

      expect(results[0].startTime).toBe('10:00')
      expect(results[1].startTime).toBe('14:00')
    })
  })

  describe('utility methods', () => {
    it('should clear all bookings', async () => {
      await repository.save(createBooking({ id: 'booking-1' }))
      await repository.save(createBooking({ id: 'booking-2' }))

      repository.clear()

      const all = repository.getAll()
      expect(all).toHaveLength(0)
    })

    it('should get all bookings', async () => {
      const booking1 = createBooking({ id: 'booking-1' })
      const booking2 = createBooking({ id: 'booking-2' })

      await repository.save(booking1)
      await repository.save(booking2)

      const all = repository.getAll()

      expect(all).toHaveLength(2)
    })
  })

  describe('constructor with initial data', () => {
    it('should initialize with bookings', () => {
      const booking1 = createBooking({ id: 'booking-1' })
      const booking2 = createBooking({ id: 'booking-2' })

      const repo = new MockBookingRepository([booking1, booking2])

      const all = repo.getAll()
      expect(all).toHaveLength(2)
    })
  })

  describe('createWithOverlapCheck', () => {
    const createBookingData = (overrides = {}) => ({
      customerId: 'customer-456',
      providerId: 'provider-789',
      serviceId: 'service-001',
      bookingDate: new Date('2025-01-15'),
      startTime: '10:00',
      endTime: '11:00',
      horseName: 'Thunder',
      customerNotes: 'Test booking',
      ...overrides,
    })

    it('should create booking when no overlap exists', async () => {
      const data = createBookingData()

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()
      expect(result?.customerId).toBe('customer-456')
      expect(result?.providerId).toBe('provider-789')
      expect(result?.startTime).toBe('10:00')
      expect(result?.endTime).toBe('11:00')
      expect(result?.status).toBe('pending')
    })

    it('should return null when overlap exists', async () => {
      // First, save an existing booking
      await repository.save(
        createBooking({
          id: 'existing-booking',
          providerId: 'provider-789',
          bookingDate: new Date('2025-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      // Try to create overlapping booking
      const data = createBookingData({
        startTime: '10:30',
        endTime: '11:30',
      })

      const result = await repository.createWithOverlapCheck(data)

      expect(result).toBeNull()
    })

    it('should create booking when times are adjacent (no overlap)', async () => {
      // First, save an existing booking
      await repository.save(
        createBooking({
          id: 'existing-booking',
          providerId: 'provider-789',
          bookingDate: new Date('2025-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      // Create booking that starts when existing one ends
      const data = createBookingData({
        startTime: '11:00',
        endTime: '12:00',
      })

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()
      expect(result?.startTime).toBe('11:00')
    })

    it('should include relations data in result', async () => {
      const data = createBookingData()

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()
      expect(result?.customer).toBeDefined()
      expect(result?.customer?.firstName).toBe('Mock')
      expect(result?.service).toBeDefined()
      expect(result?.service?.name).toBe('Mock Service')
      expect(result?.provider).toBeDefined()
      expect(result?.provider?.businessName).toBe('Mock Provider AB')
    })

    it('should ignore cancelled bookings when checking overlap', async () => {
      // Save a cancelled booking
      await repository.save(
        createBooking({
          id: 'cancelled-booking',
          providerId: 'provider-789',
          bookingDate: new Date('2025-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'cancelled',
        })
      )

      // Create booking at same time should succeed
      const data = createBookingData({
        startTime: '10:00',
        endTime: '11:00',
      })

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()
    })

    it('should only check overlap for same provider', async () => {
      // Save booking for different provider
      await repository.save(
        createBooking({
          id: 'other-provider-booking',
          providerId: 'other-provider',
          bookingDate: new Date('2025-01-15'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      // Create booking at same time for different provider should succeed
      const data = createBookingData({
        startTime: '10:00',
        endTime: '11:00',
      })

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()
    })

    it('should only check overlap for same date', async () => {
      // Save booking for different date
      await repository.save(
        createBooking({
          id: 'different-date-booking',
          providerId: 'provider-789',
          bookingDate: new Date('2025-01-16'),
          startTime: '10:00',
          endTime: '11:00',
          status: 'confirmed',
        })
      )

      // Create booking at same time but different date should succeed
      const data = createBookingData({
        bookingDate: new Date('2025-01-15'),
        startTime: '10:00',
        endTime: '11:00',
      })

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()
    })

    it('should persist booking to repository', async () => {
      const data = createBookingData()

      const result = await repository.createWithOverlapCheck(data)

      expect(result).not.toBeNull()

      // Verify booking was persisted
      const all = repository.getAll()
      expect(all).toHaveLength(1)
      expect(all[0].customerId).toBe('customer-456')
    })
  })
})
