import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingSeriesService, BookingSeriesServiceDeps } from './BookingSeriesService'
import { MockBookingRepository } from '@/infrastructure/persistence/booking/MockBookingRepository'
import { BookingWithRelations } from '@/infrastructure/persistence/booking/IBookingRepository'

// Helpers
const PROVIDER_ID = 'a0000000-0000-4000-a000-000000000001'
const CUSTOMER_ID = 'a0000000-0000-4000-a000-000000000002'
const SERVICE_ID = 'a0000000-0000-4000-a000-000000000003'
const HORSE_ID = 'a0000000-0000-4000-a000-000000000004'

function makeSharedPrismaMocks() {
  const bookingSeriesMocks = {
    create: vi.fn().mockResolvedValue({
      id: 'series-1',
      customerId: CUSTOMER_ID,
      providerId: PROVIDER_ID,
      serviceId: SERVICE_ID,
      horseId: null,
      intervalWeeks: 2,
      totalOccurrences: 4,
      createdCount: 0,
      startTime: '10:00',
      status: 'active',
      cancelledAt: null,
      createdAt: new Date(),
    }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn().mockResolvedValue(null),
  }

  const bookingMocks = {
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  }

  const $transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
    return fn({
      bookingSeries: bookingSeriesMocks,
      booking: bookingMocks,
    })
  })

  return { bookingSeriesMocks, bookingMocks, $transaction }
}

function createDeps(overrides?: Partial<BookingSeriesServiceDeps>): BookingSeriesServiceDeps {
  const mockRepo = new MockBookingRepository()
  const { bookingSeriesMocks, bookingMocks, $transaction } = makeSharedPrismaMocks()

  return {
    bookingRepository: mockRepo,
    prisma: {
      bookingSeries: bookingSeriesMocks,
      booking: bookingMocks,
      $transaction,
    } as never,
    getProvider: vi.fn().mockResolvedValue({
      id: PROVIDER_ID,
      userId: 'provider-user-1',
      isActive: true,
      recurringEnabled: true,
      maxSeriesOccurrences: 12,
    }),
    getService: vi.fn().mockResolvedValue({
      id: SERVICE_ID,
      providerId: PROVIDER_ID,
      durationMinutes: 60,
      isActive: true,
    }),
    bookingService: {
      createBooking: vi.fn().mockImplementation(async () => {
        return {
          isSuccess: true,
          value: makeFakeBooking(),
        }
      }),
      createManualBooking: vi.fn().mockImplementation(async () => {
        return {
          isSuccess: true,
          value: makeFakeBooking(),
        }
      }),
    } as never,
    ...overrides,
  }
}

let bookingCounter = 0
function makeFakeBooking(overrides?: Partial<BookingWithRelations>): BookingWithRelations {
  bookingCounter++
  return {
    id: `booking-${bookingCounter}`,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    serviceId: SERVICE_ID,
    bookingDate: new Date('2026-04-01'),
    startTime: '10:00',
    endTime: '11:00',
    status: 'confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function futureDate(weeksFromNow: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + weeksFromNow * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

describe('BookingSeriesService', () => {
  beforeEach(() => {
    bookingCounter = 0
  })

  describe('createSeries', () => {
    it('returns RECURRING_DISABLED when provider has disabled recurring', async () => {
      const deps = createDeps({
        getProvider: vi.fn().mockResolvedValue({
          id: PROVIDER_ID,
          userId: 'provider-user-1',
          isActive: true,
          recurringEnabled: false,
          maxSeriesOccurrences: 12,
        }),
      })
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 4,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('RECURRING_DISABLED')
    })

    it('returns INVALID_INTERVAL for interval 0', async () => {
      const deps = createDeps()
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 0,
        totalOccurrences: 4,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_INTERVAL')
    })

    it('returns INVALID_INTERVAL for interval 53', async () => {
      const deps = createDeps()
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 53,
        totalOccurrences: 4,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_INTERVAL')
    })

    it('returns INVALID_OCCURRENCES when exceeding provider max', async () => {
      const deps = createDeps({
        getProvider: vi.fn().mockResolvedValue({
          id: PROVIDER_ID,
          userId: 'provider-user-1',
          isActive: true,
          recurringEnabled: true,
          maxSeriesOccurrences: 6,
        }),
      })
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 8,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_OCCURRENCES')
      expect((result.error as never).max).toBe(6)
    })

    it('returns INVALID_OCCURRENCES for totalOccurrences < 2', async () => {
      const deps = createDeps()
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 1,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_OCCURRENCES')
    })

    it('creates a series atomically: BookingSeries + bookingSeriesId link in $transaction', async () => {
      const deps = createDeps()
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 4,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.series.totalOccurrences).toBe(4)
      expect(result.value.createdBookings).toHaveLength(4)
      expect(result.value.skippedDates).toHaveLength(0)

      // Series created inside $transaction with correct createdCount
      expect(deps.prisma.$transaction).toHaveBeenCalled()
      expect(deps.prisma.bookingSeries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdCount: 4, status: 'active' }),
        })
      )

      // All bookings linked to the series via updateMany
      expect(deps.prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.any(Array) } },
          data: { bookingSeriesId: 'series-1' },
        })
      )
    })

    it('skips dates that cause OVERLAP and continues', async () => {
      let callCount = 0
      const deps = createDeps({
        bookingService: {
          createBooking: vi.fn().mockImplementation(async () => {
            callCount++
            if (callCount === 2) {
              return {
                isSuccess: false,
                isFailure: true,
                error: { type: 'OVERLAP', message: 'Already booked' },
              }
            }
            return { isSuccess: true, value: makeFakeBooking() }
          }),
          createManualBooking: vi.fn(),
        } as never,
      })
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 4,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.createdBookings).toHaveLength(3)
      expect(result.value.skippedDates).toHaveLength(1)
      expect(result.value.skippedDates[0].reason).toContain('Already booked')
    })

    it('skips dates that cause PROVIDER_CLOSED and continues', async () => {
      let callCount = 0
      const deps = createDeps({
        bookingService: {
          createBooking: vi.fn().mockImplementation(async () => {
            callCount++
            if (callCount === 3) {
              return {
                isSuccess: false,
                isFailure: true,
                error: { type: 'PROVIDER_CLOSED', message: 'Closed' },
              }
            }
            return { isSuccess: true, value: makeFakeBooking() }
          }),
          createManualBooking: vi.fn(),
        } as never,
      })
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 4,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.createdBookings).toHaveLength(3)
      expect(result.value.skippedDates).toHaveLength(1)
    })

    it('returns NO_BOOKINGS_CREATED when all dates fail, no series written to DB', async () => {
      const deps = createDeps({
        bookingService: {
          createBooking: vi.fn().mockResolvedValue({
            isSuccess: false,
            isFailure: true,
            error: { type: 'OVERLAP', message: 'All booked' },
          }),
          createManualBooking: vi.fn(),
        } as never,
      })
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 4,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NO_BOOKINGS_CREATED')
      // No series created since we short-circuit before the $transaction
      expect(deps.prisma.bookingSeries.create).not.toHaveBeenCalled()
    })

    it('propagates exception on conflict, rolls back created bookings, no series created', async () => {
      let callCount = 0
      const deleteSpy = vi.fn().mockResolvedValue(undefined)
      const deps = createDeps({
        bookingService: {
          createBooking: vi.fn().mockImplementation(async () => {
            callCount++
            if (callCount === 3) {
              throw new Error('DB unique constraint violation')
            }
            return { isSuccess: true, value: makeFakeBooking() }
          }),
          createManualBooking: vi.fn(),
        } as never,
      })
      deps.bookingRepository.delete = deleteSpy

      const service = new BookingSeriesService(deps)

      await expect(
        service.createSeries({
          customerId: CUSTOMER_ID,
          providerId: PROVIDER_ID,
          serviceId: SERVICE_ID,
          firstBookingDate: futureDate(1),
          startTime: '10:00',
          intervalWeeks: 2,
          totalOccurrences: 5,
        })
      ).rejects.toThrow('DB unique constraint violation')

      // No series created (transaction never ran)
      expect(deps.prisma.bookingSeries.create).not.toHaveBeenCalled()
      // Cleanup attempted for bookings 1 and 2
      expect(deleteSpy).toHaveBeenCalledTimes(2)
    })

    it('uses createManualBooking when isManualBooking is true', async () => {
      const deps = createDeps()
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 3,
        isManualBooking: true,
        createdByProviderId: PROVIDER_ID,
      })

      expect(result.isSuccess).toBe(true)
      expect(deps.bookingService.createManualBooking).toHaveBeenCalledTimes(3)
      expect(deps.bookingService.createBooking).not.toHaveBeenCalled()
    })

    it('passes horse info to each booking', async () => {
      const deps = createDeps()
      const service = new BookingSeriesService(deps)

      await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 2,
        horseId: HORSE_ID,
        horseName: 'Blansen',
        horseInfo: 'Lite känslig i hovarna',
      })

      const call = vi.mocked(deps.bookingService.createBooking).mock.calls[0][0]
      expect(call.horseId).toBe(HORSE_ID)
      expect(call.horseName).toBe('Blansen')
      expect(call.horseInfo).toBe('Lite känslig i hovarna')
    })

    it('returns error when provider not found', async () => {
      const deps = createDeps({
        getProvider: vi.fn().mockResolvedValue(null),
      })
      const service = new BookingSeriesService(deps)

      const result = await service.createSeries({
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        serviceId: SERVICE_ID,
        firstBookingDate: futureDate(1),
        startTime: '10:00',
        intervalWeeks: 2,
        totalOccurrences: 4,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('RECURRING_DISABLED')
    })
  })

  describe('cancelSeries', () => {
    function makeCancelDeps(seriesOverrides?: Record<string, unknown>, bookingUpdateCount = 1) {
      const { bookingSeriesMocks, bookingMocks, $transaction } = makeSharedPrismaMocks()
      bookingSeriesMocks.findUnique = vi.fn().mockResolvedValue({
        id: 'series-1',
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
        status: 'active',
        ...seriesOverrides,
      })
      bookingMocks.updateMany = vi.fn().mockResolvedValue({ count: bookingUpdateCount })

      const mockRepo = new MockBookingRepository()
      return {
        bookingRepository: mockRepo,
        prisma: {
          bookingSeries: bookingSeriesMocks,
          booking: bookingMocks,
          $transaction,
        } as never,
        isFeatureEnabled: vi.fn().mockResolvedValue(true),
        getProvider: vi.fn(),
        getService: vi.fn(),
        bookingService: {} as never,
      }
    }

    it('atomically cancels future bookings and marks series as cancelled', async () => {
      const deps = makeCancelDeps({}, 1)
      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'series-1',
        actorCustomerId: CUSTOMER_ID,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.cancelledCount).toBe(1)

      // Transaction ran
      expect(deps.prisma.$transaction).toHaveBeenCalled()

      // booking.updateMany called with correct filters
      expect(deps.prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bookingSeriesId: 'series-1',
            status: { in: ['pending', 'confirmed'] },
          }),
          data: expect.objectContaining({ status: 'cancelled' }),
        })
      )

      // Series marked as cancelled
      expect(deps.prisma.bookingSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'series-1' },
          data: expect.objectContaining({ status: 'cancelled' }),
        })
      )
    })

    it('returns error when series not found', async () => {
      const { bookingSeriesMocks, bookingMocks, $transaction } = makeSharedPrismaMocks()
      bookingSeriesMocks.findUnique = vi.fn().mockResolvedValue(null)
      const deps: BookingSeriesServiceDeps = {
        bookingRepository: new MockBookingRepository(),
        prisma: { bookingSeries: bookingSeriesMocks, booking: bookingMocks, $transaction } as never,
        isFeatureEnabled: vi.fn(),
        getProvider: vi.fn(),
        getService: vi.fn(),
        bookingService: {} as never,
      }
      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'nonexistent',
        actorCustomerId: CUSTOMER_ID,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('SERIES_NOT_FOUND')
    })

    it('returns error when actor is not owner', async () => {
      const deps = makeCancelDeps({
        customerId: 'other-customer',
        providerId: 'other-provider',
      })
      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'series-1',
        actorCustomerId: CUSTOMER_ID,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NOT_OWNER')
    })

    it('allows provider to cancel their series', async () => {
      const deps = makeCancelDeps({}, 0)
      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'series-1',
        actorProviderId: PROVIDER_ID,
      })

      expect(result.isSuccess).toBe(true)
    })
  })
})
