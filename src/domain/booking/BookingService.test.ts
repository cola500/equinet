import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BookingService,
  BookingServiceDeps,
  CreateBookingDTO,
  ServiceInfo,
  ProviderInfo,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from './BookingService'
import { MockBookingRepository } from '@/infrastructure/persistence/booking/MockBookingRepository'

describe('BookingService', () => {
  let bookingRepository: MockBookingRepository
  let mockGetService: ReturnType<typeof vi.fn>
  let mockGetProvider: ReturnType<typeof vi.fn>
  let mockGetRouteOrder: ReturnType<typeof vi.fn>
  let deps: BookingServiceDeps
  let service: BookingService

  const validService: ServiceInfo = {
    id: 'service-1',
    providerId: 'provider-1',
    durationMinutes: 60,
    isActive: true,
  }

  const validProvider: ProviderInfo = {
    id: 'provider-1',
    userId: 'provider-user-1',
    isActive: true,
  }

  const validDTO: CreateBookingDTO = {
    customerId: 'customer-1',
    providerId: 'provider-1',
    serviceId: 'service-1',
    bookingDate: new Date('2025-02-01'),
    startTime: '10:00',
    horseName: 'Thunder',
  }

  beforeEach(() => {
    bookingRepository = new MockBookingRepository()
    mockGetService = vi.fn().mockResolvedValue(validService)
    mockGetProvider = vi.fn().mockResolvedValue(validProvider)
    mockGetRouteOrder = vi.fn()

    deps = {
      bookingRepository,
      getService: mockGetService,
      getProvider: mockGetProvider,
      getRouteOrder: mockGetRouteOrder,
    }

    service = new BookingService(deps)
  })

  describe('createBooking', () => {
    it('should create booking successfully with valid data', async () => {
      const result = await service.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
      expect(result.value.customerId).toBe('customer-1')
      expect(result.value.providerId).toBe('provider-1')
      expect(result.value.startTime).toBe('10:00')
      expect(result.value.endTime).toBe('11:00') // Calculated from duration
      expect(result.value.status).toBe('pending')
    })

    it('should calculate endTime from service duration when not provided', async () => {
      const result = await service.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
      expect(result.value.endTime).toBe('11:00') // 10:00 + 60 min
    })

    it('should use provided endTime when available', async () => {
      const dto: CreateBookingDTO = {
        ...validDTO,
        endTime: '12:00',
      }

      const result = await service.createBooking(dto)

      expect(result.isSuccess).toBe(true)
      expect(result.value.endTime).toBe('12:00')
    })

    it('should fail when service is not found', async () => {
      mockGetService.mockResolvedValue(null)

      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INACTIVE_SERVICE')
    })

    it('should fail when service is inactive', async () => {
      mockGetService.mockResolvedValue({ ...validService, isActive: false })

      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INACTIVE_SERVICE')
    })

    it('should fail when service does not belong to provider', async () => {
      mockGetService.mockResolvedValue({ ...validService, providerId: 'other-provider' })

      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('SERVICE_PROVIDER_MISMATCH')
    })

    it('should fail when provider is not found', async () => {
      mockGetProvider.mockResolvedValue(null)

      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INACTIVE_PROVIDER')
    })

    it('should fail when provider is inactive', async () => {
      mockGetProvider.mockResolvedValue({ ...validProvider, isActive: false })

      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INACTIVE_PROVIDER')
    })

    it('should fail when customer tries to book own service (self-booking)', async () => {
      mockGetProvider.mockResolvedValue({ ...validProvider, userId: 'customer-1' })

      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('SELF_BOOKING')
    })

    it('should fail when times are invalid', async () => {
      const dto: CreateBookingDTO = {
        ...validDTO,
        startTime: '07:00', // Before business hours
      }

      const result = await service.createBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_TIMES')
      expect(result.error.message).toContain('öppettider')
    })

    it('should fail when end time is before start time', async () => {
      const dto: CreateBookingDTO = {
        ...validDTO,
        startTime: '11:00',
        endTime: '10:00',
      }

      const result = await service.createBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_TIMES')
    })

    it('should fail when booking overlaps with existing', async () => {
      // First booking succeeds
      await service.createBooking(validDTO)

      // Second booking at same time should fail
      const result = await service.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('OVERLAP')
    })

    it('should allow adjacent bookings (no overlap)', async () => {
      // First booking 10:00-11:00
      await service.createBooking(validDTO)

      // Second booking 11:00-12:00 should succeed
      const dto: CreateBookingDTO = {
        ...validDTO,
        startTime: '11:00',
        endTime: '12:00',
      }

      const result = await service.createBooking(dto)

      expect(result.isSuccess).toBe(true)
    })

    it('should include optional fields in booking', async () => {
      const dto: CreateBookingDTO = {
        ...validDTO,
        horseName: 'Thunder',
        horseInfo: 'Lugn häst',
        customerNotes: 'Ring vid ankomst',
      }

      const result = await service.createBooking(dto)

      expect(result.isSuccess).toBe(true)
      // Note: Mock returns mock data, but the data was passed to repository
      const allBookings = bookingRepository.getAll()
      expect(allBookings[0].horseName).toBe('Thunder')
    })
  })

  describe('route order validation', () => {
    it('should pass when route order is valid', async () => {
      mockGetRouteOrder.mockResolvedValue({
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-03-01'),
        status: 'open',
        providerId: 'provider-1',
      })

      const dto: CreateBookingDTO = {
        ...validDTO,
        routeOrderId: 'route-order-1',
      }

      const result = await service.createBooking(dto)

      expect(result.isSuccess).toBe(true)
    })

    it('should fail when route order is not found', async () => {
      mockGetRouteOrder.mockResolvedValue(null)

      const dto: CreateBookingDTO = {
        ...validDTO,
        routeOrderId: 'non-existent',
      }

      const result = await service.createBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_ROUTE_ORDER')
      expect(result.error.message).toContain('hittades inte')
    })

    it('should fail when route order is not open', async () => {
      mockGetRouteOrder.mockResolvedValue({
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-03-01'),
        status: 'closed',
        providerId: 'provider-1',
      })

      const dto: CreateBookingDTO = {
        ...validDTO,
        routeOrderId: 'route-order-1',
      }

      const result = await service.createBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_ROUTE_ORDER')
      expect(result.error.message).toContain('inte längre öppen')
    })

    it('should fail when booking date is outside route order span', async () => {
      mockGetRouteOrder.mockResolvedValue({
        dateFrom: new Date('2025-03-01'),
        dateTo: new Date('2025-03-31'),
        status: 'open',
        providerId: 'provider-1',
      })

      const dto: CreateBookingDTO = {
        ...validDTO,
        bookingDate: new Date('2025-02-01'), // Before route order
        routeOrderId: 'route-order-1',
      }

      const result = await service.createBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_ROUTE_ORDER')
      expect(result.error.message).toContain('datum-spann')
    })

    it('should fail when provider does not match route order', async () => {
      mockGetRouteOrder.mockResolvedValue({
        dateFrom: new Date('2025-01-01'),
        dateTo: new Date('2025-03-01'),
        status: 'open',
        providerId: 'other-provider',
      })

      const dto: CreateBookingDTO = {
        ...validDTO,
        routeOrderId: 'route-order-1',
      }

      const result = await service.createBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_ROUTE_ORDER')
      expect(result.error.message).toContain('matchar inte')
    })
  })

  describe('mapBookingErrorToStatus', () => {
    it('should return 400 for validation errors', () => {
      expect(mapBookingErrorToStatus({ type: 'INVALID_TIMES', message: 'test' })).toBe(400)
      expect(mapBookingErrorToStatus({ type: 'INACTIVE_SERVICE' })).toBe(400)
      expect(mapBookingErrorToStatus({ type: 'INACTIVE_PROVIDER' })).toBe(400)
      expect(mapBookingErrorToStatus({ type: 'SELF_BOOKING' })).toBe(400)
      expect(mapBookingErrorToStatus({ type: 'SERVICE_PROVIDER_MISMATCH' })).toBe(400)
      expect(mapBookingErrorToStatus({ type: 'INVALID_ROUTE_ORDER', message: 'test' })).toBe(400)
    })

    it('should return 409 for overlap errors', () => {
      expect(mapBookingErrorToStatus({ type: 'OVERLAP', message: 'test' })).toBe(409)
    })
  })

  describe('mapBookingErrorToMessage', () => {
    it('should return user-friendly messages', () => {
      expect(mapBookingErrorToMessage({ type: 'INVALID_TIMES', message: 'Custom message' }))
        .toBe('Custom message')
      expect(mapBookingErrorToMessage({ type: 'INACTIVE_SERVICE' }))
        .toBe('Tjänsten är inte längre tillgänglig')
      expect(mapBookingErrorToMessage({ type: 'INACTIVE_PROVIDER' }))
        .toBe('Leverantören är för närvarande inte tillgänglig')
      expect(mapBookingErrorToMessage({ type: 'SELF_BOOKING' }))
        .toBe('Du kan inte boka din egen tjänst')
      expect(mapBookingErrorToMessage({ type: 'SERVICE_PROVIDER_MISMATCH' }))
        .toBe('Ogiltig tjänst')
      expect(mapBookingErrorToMessage({ type: 'OVERLAP', message: 'Already booked' }))
        .toBe('Already booked')
    })
  })
})
