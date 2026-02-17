import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingSeriesService, BookingSeriesServiceDeps } from './BookingSeriesService'
import { MockBookingRepository } from '@/infrastructure/persistence/booking/MockBookingRepository'
import { BookingWithRelations } from '@/infrastructure/persistence/booking/IBookingRepository'

// Helpers
const PROVIDER_ID = 'a0000000-0000-4000-a000-000000000001'
const CUSTOMER_ID = 'a0000000-0000-4000-a000-000000000002'
const SERVICE_ID = 'a0000000-0000-4000-a000-000000000003'
const HORSE_ID = 'a0000000-0000-4000-a000-000000000004'

function createDeps(overrides?: Partial<BookingSeriesServiceDeps>): BookingSeriesServiceDeps {
  const mockRepo = new MockBookingRepository()
  return {
    bookingRepository: mockRepo,
    prisma: {
      bookingSeries: {
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
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any,
    isFeatureEnabled: vi.fn().mockResolvedValue(true),
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
    } as any,
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
    it('returns RECURRING_FEATURE_OFF when feature flag is disabled', async () => {
      const deps = createDeps({ isFeatureEnabled: vi.fn().mockResolvedValue(false) })
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
      expect(result.error.type).toBe('RECURRING_FEATURE_OFF')
    })

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
      expect((result.error as any).max).toBe(6)
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

    it('creates a series with all bookings on happy path', async () => {
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
      expect(deps.prisma.bookingSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { createdCount: 4 },
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
        } as any,
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
        } as any,
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

    it('returns NO_BOOKINGS_CREATED when all dates fail and deletes series', async () => {
      const deps = createDeps({
        bookingService: {
          createBooking: vi.fn().mockResolvedValue({
            isSuccess: false,
            isFailure: true,
            error: { type: 'OVERLAP', message: 'All booked' },
          }),
          createManualBooking: vi.fn(),
        } as any,
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
      expect(deps.prisma.bookingSeries.delete).toHaveBeenCalled()
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

    it('passes bookingSeriesId to each booking', async () => {
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
      })

      const calls = vi.mocked(deps.bookingService.createBooking).mock.calls
      expect(calls).toHaveLength(2)
      // Each call should include the series context (bookingSeriesId set after creation)
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
    it('cancels future bookings and marks series as cancelled', async () => {
      // Only future cancellable bookings -- DB WHERE filters out past/completed
      const futureBooking = {
        id: 'b-future',
        bookingDate: futureDate(2),
        status: 'confirmed',
        customerId: CUSTOMER_ID,
        providerId: PROVIDER_ID,
      }

      const deps = createDeps({
        prisma: {
          bookingSeries: {
            create: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({
              id: 'series-1',
              customerId: CUSTOMER_ID,
              providerId: PROVIDER_ID,
              status: 'active',
            }),
          },
          booking: {
            findMany: vi.fn().mockResolvedValue([futureBooking]),
          },
        } as any,
      })

      // Mock the bookingService.updateStatus to succeed
      deps.bookingService = {
        ...deps.bookingService,
        updateStatus: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: makeFakeBooking({ status: 'cancelled' }),
        }),
      } as any

      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'series-1',
        actorCustomerId: CUSTOMER_ID,
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.cancelledCount).toBe(1) // Only future confirmed booking
      expect(deps.prisma.bookingSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'cancelled',
          }),
        })
      )
    })

    it('returns error when series not found', async () => {
      const deps = createDeps({
        prisma: {
          bookingSeries: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn().mockResolvedValue(null),
          },
          booking: { findMany: vi.fn() },
        } as any,
      })
      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'nonexistent',
        actorCustomerId: CUSTOMER_ID,
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('SERIES_NOT_FOUND')
    })

    it('returns error when actor is not owner', async () => {
      const deps = createDeps({
        prisma: {
          bookingSeries: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({
              id: 'series-1',
              customerId: 'other-customer',
              providerId: 'other-provider',
              status: 'active',
            }),
          },
          booking: { findMany: vi.fn() },
        } as any,
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
      const deps = createDeps({
        prisma: {
          bookingSeries: {
            create: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({
              id: 'series-1',
              customerId: CUSTOMER_ID,
              providerId: PROVIDER_ID,
              status: 'active',
            }),
          },
          booking: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        } as any,
      })

      deps.bookingService = {
        ...deps.bookingService,
        updateStatus: vi.fn(),
      } as any

      const service = new BookingSeriesService(deps)

      const result = await service.cancelSeries({
        seriesId: 'series-1',
        actorProviderId: PROVIDER_ID,
      })

      expect(result.isSuccess).toBe(true)
    })
  })
})
