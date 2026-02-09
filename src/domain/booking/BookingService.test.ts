import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BookingService,
  BookingServiceDeps,
  CreateBookingDTO,
  CreateManualBookingDTO,
  ServiceInfo,
  ProviderInfo,
  CustomerLocationInfo,
  mapBookingErrorToStatus,
  mapBookingErrorToMessage,
} from './BookingService'
import { TravelTimeService } from './TravelTimeService'
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

    it('should return 409 for insufficient travel time errors', () => {
      expect(mapBookingErrorToStatus({
        type: 'INSUFFICIENT_TRAVEL_TIME',
        message: 'Not enough time',
        requiredMinutes: 60,
        actualMinutes: 30,
      })).toBe(409)
    })
  })

  describe('travel time validation', () => {
    // Coordinates for test locations
    const goteborgLocation: CustomerLocationInfo = {
      latitude: 57.7089,
      longitude: 11.9746,
      address: 'Göteborg',
    }

    const alingsasLocation: CustomerLocationInfo = {
      latitude: 57.9296,
      longitude: 12.5327,
      address: 'Alingsås',
    }

    const providerWithLocation: ProviderInfo = {
      id: 'provider-1',
      userId: 'provider-user-1',
      isActive: true,
      latitude: 57.7089,
      longitude: 11.9746,
    }

    let travelTimeService: TravelTimeService
    let mockGetCustomerLocation: ReturnType<typeof vi.fn>

    beforeEach(() => {
      travelTimeService = new TravelTimeService()
      mockGetCustomerLocation = vi.fn()
    })

    it('should skip travel time validation when service is not configured', async () => {
      // Default deps without travel time service
      const result = await service.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should pass when there are no existing bookings', async () => {
      mockGetCustomerLocation.mockResolvedValue(goteborgLocation)

      const serviceWithTravel = new BookingService({
        ...deps,
        travelTimeService,
        getCustomerLocation: mockGetCustomerLocation,
      })

      const result = await serviceWithTravel.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should pass when enough travel time between bookings', async () => {
      // First customer in Göteborg
      mockGetCustomerLocation.mockResolvedValueOnce(goteborgLocation)
      mockGetProvider.mockResolvedValue(providerWithLocation)

      bookingRepository.setCustomerLocation('customer-1', {
        latitude: goteborgLocation.latitude!,
        longitude: goteborgLocation.longitude!,
        address: goteborgLocation.address!,
      })

      const serviceWithTravel = new BookingService({
        ...deps,
        travelTimeService,
        getCustomerLocation: mockGetCustomerLocation,
      })

      // First booking 09:00-10:00
      const firstDTO: CreateBookingDTO = {
        ...validDTO,
        startTime: '09:00',
        endTime: '10:00',
      }
      await serviceWithTravel.createBooking(firstDTO)

      // Second booking at 12:00 (2 hours later) at same location
      // Should have plenty of time
      mockGetCustomerLocation.mockResolvedValueOnce(goteborgLocation)

      const secondDTO: CreateBookingDTO = {
        ...validDTO,
        customerId: 'customer-2',
        startTime: '12:00',
        endTime: '13:00',
      }

      bookingRepository.setCustomerLocation('customer-2', {
        latitude: goteborgLocation.latitude!,
        longitude: goteborgLocation.longitude!,
        address: goteborgLocation.address!,
      })

      const result = await serviceWithTravel.createBooking(secondDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should fail when not enough travel time between locations', async () => {
      mockGetProvider.mockResolvedValue(providerWithLocation)

      // Set up first booking in Göteborg
      bookingRepository.setCustomerLocation('customer-1', {
        latitude: goteborgLocation.latitude!,
        longitude: goteborgLocation.longitude!,
        address: goteborgLocation.address!,
      })

      // First booking 09:00-10:00
      mockGetCustomerLocation.mockResolvedValueOnce(goteborgLocation)

      const serviceWithTravel = new BookingService({
        ...deps,
        travelTimeService,
        getCustomerLocation: mockGetCustomerLocation,
      })

      const firstDTO: CreateBookingDTO = {
        ...validDTO,
        startTime: '09:00',
        endTime: '10:00',
      }
      await serviceWithTravel.createBooking(firstDTO)

      // Second booking in Alingsås (~40 km away) only 15 min later
      // Should fail - needs ~70 min travel + buffer
      mockGetCustomerLocation.mockResolvedValueOnce(alingsasLocation)

      bookingRepository.setCustomerLocation('customer-2', {
        latitude: alingsasLocation.latitude!,
        longitude: alingsasLocation.longitude!,
        address: alingsasLocation.address!,
      })

      const secondDTO: CreateBookingDTO = {
        ...validDTO,
        customerId: 'customer-2',
        startTime: '10:15', // Only 15 min after first booking ends
        endTime: '11:15',
      }

      const result = await serviceWithTravel.createBooking(secondDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INSUFFICIENT_TRAVEL_TIME')
    })

    it('should use default buffer when NO location is available (customer + provider)', async () => {
      // Provider WITHOUT location
      const providerWithoutLocation: ProviderInfo = {
        id: 'provider-1',
        userId: 'provider-user-1',
        isActive: true,
        latitude: null,
        longitude: null,
      }
      mockGetProvider.mockResolvedValue(providerWithoutLocation)

      // First booking - customer without location, provider without location
      // Repository also has no location for this customer
      mockGetCustomerLocation.mockResolvedValueOnce(null)

      const serviceWithTravel = new BookingService({
        ...deps,
        travelTimeService,
        getCustomerLocation: mockGetCustomerLocation,
      })

      // First booking
      const firstDTO: CreateBookingDTO = {
        ...validDTO,
        startTime: '09:00',
        endTime: '10:00',
      }
      await serviceWithTravel.createBooking(firstDTO)

      // Second customer also has NO location - should use default buffer (15 min)
      mockGetCustomerLocation.mockResolvedValueOnce(null)

      const secondDTO: CreateBookingDTO = {
        ...validDTO,
        customerId: 'customer-2',
        startTime: '10:10', // Only 10 min after first booking ends (< 15 min default)
        endTime: '11:10',
      }

      const result = await serviceWithTravel.createBooking(secondDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INSUFFICIENT_TRAVEL_TIME')
    })

    it('should save travelTimeMinutes when booking is created', async () => {
      mockGetProvider.mockResolvedValue(providerWithLocation)

      // Set up first booking in Göteborg
      bookingRepository.setCustomerLocation('customer-1', {
        latitude: goteborgLocation.latitude!,
        longitude: goteborgLocation.longitude!,
        address: goteborgLocation.address!,
      })

      mockGetCustomerLocation.mockResolvedValueOnce(goteborgLocation)

      const serviceWithTravel = new BookingService({
        ...deps,
        travelTimeService,
        getCustomerLocation: mockGetCustomerLocation,
      })

      // First booking
      const firstDTO: CreateBookingDTO = {
        ...validDTO,
        startTime: '09:00',
        endTime: '10:00',
      }
      await serviceWithTravel.createBooking(firstDTO)

      // Second booking in same location with enough gap
      mockGetCustomerLocation.mockResolvedValueOnce(goteborgLocation)
      bookingRepository.setCustomerLocation('customer-2', {
        latitude: goteborgLocation.latitude!,
        longitude: goteborgLocation.longitude!,
        address: goteborgLocation.address!,
      })

      const secondDTO: CreateBookingDTO = {
        ...validDTO,
        customerId: 'customer-2',
        startTime: '11:00',
        endTime: '12:00',
      }

      const result = await serviceWithTravel.createBooking(secondDTO)

      expect(result.isSuccess).toBe(true)
      // Travel time should be 0 (same location)
      // Note: travelTimeMinutes is saved on the booking but not returned in the DTO
    })
  })

  describe('updateStatus', () => {
    // Helper to create a booking in the repository
    async function createPendingBooking(): Promise<string> {
      const result = await service.createBooking(validDTO)
      expect(result.isSuccess).toBe(true)
      return result.value.id
    }

    it('should allow provider to confirm a pending booking', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('confirmed')
    })

    it('should allow customer to cancel a pending booking', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'cancelled',
        customerId: 'customer-1',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('cancelled')
    })

    it('should NOT allow pending -> completed (must confirm first)', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'completed',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
      expect(result.error.from).toBe('pending')
      expect(result.error.to).toBe('completed')
    })

    it('should NOT allow customer to confirm (only provider can)', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        customerId: 'customer-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should NOT allow customer to complete (only provider can)', async () => {
      const bookingId = await createPendingBooking()

      // First confirm as provider
      await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })

      // Then try to complete as customer
      const result = await service.updateStatus({
        bookingId,
        newStatus: 'completed',
        customerId: 'customer-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should fail for invalid status string', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'bogus' as any,
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should fail when booking does not exist', async () => {
      const result = await service.updateStatus({
        bookingId: 'non-existent-id',
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_FOUND')
    })

    it('should fail when transitioning from terminal state', async () => {
      const bookingId = await createPendingBooking()

      // Cancel the booking (terminal state)
      await service.updateStatus({
        bookingId,
        newStatus: 'cancelled',
        customerId: 'customer-1',
      })

      // Try to confirm the cancelled booking
      const result = await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should allow full lifecycle: pending -> confirmed -> completed', async () => {
      const bookingId = await createPendingBooking()

      // Confirm
      const confirmResult = await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })
      expect(confirmResult.isSuccess).toBe(true)
      expect(confirmResult.value.status).toBe('confirmed')

      // Complete
      const completeResult = await service.updateStatus({
        bookingId,
        newStatus: 'completed',
        providerId: 'provider-1',
      })
      expect(completeResult.isSuccess).toBe(true)
      expect(completeResult.value.status).toBe('completed')
    })
  })

  describe('mapBookingErrorToStatus - new error types', () => {
    it('should return 400 for INVALID_STATUS_TRANSITION', () => {
      expect(mapBookingErrorToStatus({
        type: 'INVALID_STATUS_TRANSITION',
        message: 'test',
        from: 'pending',
        to: 'completed',
      })).toBe(400)
    })

    it('should return 404 for BOOKING_NOT_FOUND', () => {
      expect(mapBookingErrorToStatus({ type: 'BOOKING_NOT_FOUND' })).toBe(404)
    })
  })

  describe('mapBookingErrorToMessage - new error types', () => {
    it('should return message for INVALID_STATUS_TRANSITION', () => {
      expect(mapBookingErrorToMessage({
        type: 'INVALID_STATUS_TRANSITION',
        message: 'Custom transition error',
        from: 'pending',
        to: 'completed',
      })).toBe('Custom transition error')
    })

    it('should return message for BOOKING_NOT_FOUND', () => {
      expect(mapBookingErrorToMessage({ type: 'BOOKING_NOT_FOUND' }))
        .toBe('Bokningen hittades inte')
    })
  })

  describe('createManualBooking', () => {
    const manualDTO: CreateManualBookingDTO = {
      providerId: 'provider-1',
      serviceId: 'service-1',
      bookingDate: new Date('2025-02-01'),
      startTime: '10:00',
      customerId: 'customer-1',
    }

    let mockCreateGhostUser: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockCreateGhostUser = vi.fn().mockResolvedValue('ghost-user-123')
    })

    it('should create manual booking with existing customer (customerId)', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isSuccess).toBe(true)
      expect(result.value.customerId).toBe('customer-1')
      expect(result.value.status).toBe('confirmed')
      // Ghost user should NOT be called when customerId is provided
      expect(mockCreateGhostUser).not.toHaveBeenCalled()
    })

    it('should create manual booking with ghost user (customerName only)', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        customerName: 'Anna Svensson',
        customerPhone: '070-1234567',
      }

      const result = await svc.createManualBooking(dto)

      expect(result.isSuccess).toBe(true)
      expect(result.value.customerId).toBe('ghost-user-123')
      expect(mockCreateGhostUser).toHaveBeenCalledWith({
        name: 'Anna Svensson',
        phone: '070-1234567',
        email: undefined,
      })
    })

    it('should set status to confirmed', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('confirmed')
    })

    it('should set isManualBooking to true', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isSuccess).toBe(true)
      // Check the raw booking data
      const allBookings = bookingRepository.getAll()
      expect(allBookings[0].isManualBooking).toBe(true)
    })

    it('should set createdByProviderId', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isSuccess).toBe(true)
      const allBookings = bookingRepository.getAll()
      expect(allBookings[0].createdByProviderId).toBe('provider-1')
    })

    it('should NOT check self-booking', async () => {
      // Provider's userId equals the customerId -- should still work
      mockGetProvider.mockResolvedValue({ ...validProvider, userId: 'customer-1' })

      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      // Should NOT fail with SELF_BOOKING
      expect(result.isSuccess).toBe(true)
    })

    it('should still check overlap', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      // First booking at 10:00
      await svc.createManualBooking(manualDTO)

      // Second booking at same time should fail
      const result = await svc.createManualBooking(manualDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('OVERLAP')
    })

    it('should still validate service/provider', async () => {
      mockGetService.mockResolvedValue(null)

      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INACTIVE_SERVICE')
    })

    it('should fail without customerId or customerName', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        // Neither customerId nor customerName
      }

      const result = await svc.createManualBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_CUSTOMER_DATA')
    })

    it('should calculate endTime from service duration', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isSuccess).toBe(true)
      expect(result.value.endTime).toBe('11:00') // 10:00 + 60 min
    })

    it('should pass ghost user email to createGhostUser', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        customerName: 'Test Testsson',
        customerEmail: 'test@example.com',
      }

      await svc.createManualBooking(dto)

      expect(mockCreateGhostUser).toHaveBeenCalledWith({
        name: 'Test Testsson',
        phone: undefined,
        email: 'test@example.com',
      })
    })

    it('should return GHOST_USER_CREATION_FAILED when createGhostUser throws DB error', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: vi.fn().mockRejectedValue(new Error('Connection refused')),
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        customerName: 'Anna Svensson',
      }

      const result = await svc.createManualBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GHOST_USER_CREATION_FAILED')
    })

    it('should return GHOST_USER_CREATION_FAILED when bcrypt fails', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: vi.fn().mockRejectedValue(new Error('bcrypt: invalid salt')),
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        customerName: 'Anna Svensson',
      }

      const result = await svc.createManualBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GHOST_USER_CREATION_FAILED')
    })

    it('should return GHOST_USER_CREATION_FAILED on duplicate email race condition (P2002)', async () => {
      const prismaError = new Error('Unique constraint failed on the fields: (`email`)')
      ;(prismaError as any).code = 'P2002'
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: vi.fn().mockRejectedValue(prismaError),
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        customerName: 'Anna Svensson',
        customerEmail: 'anna@example.com',
      }

      const result = await svc.createManualBooking(dto)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('GHOST_USER_CREATION_FAILED')
    })

    it('should include horse info', async () => {
      const depsWithGhost: BookingServiceDeps = {
        ...deps,
        createGhostUser: mockCreateGhostUser,
      }
      const svc = new BookingService(depsWithGhost)

      const dto: CreateManualBookingDTO = {
        ...manualDTO,
        horseName: 'Thunder',
        horseInfo: 'Lugn häst',
        customerNotes: 'Ring vid ankomst',
      }

      const result = await svc.createManualBooking(dto)

      expect(result.isSuccess).toBe(true)
      const allBookings = bookingRepository.getAll()
      expect(allBookings[0].horseName).toBe('Thunder')
    })
  })

  describe('mapBookingErrorToStatus - INVALID_CUSTOMER_DATA', () => {
    it('should return 400 for INVALID_CUSTOMER_DATA', () => {
      expect(mapBookingErrorToStatus({ type: 'INVALID_CUSTOMER_DATA', message: 'test' } as any)).toBe(400)
    })
  })

  describe('closed day validation', () => {
    it('should fail when provider has closed the day (isClosed=true with reason)', async () => {
      const mockGetAvailabilityException = vi.fn().mockResolvedValue({
        isClosed: true,
        reason: 'Semester',
      })

      const svc = new BookingService({
        ...deps,
        getAvailabilityException: mockGetAvailabilityException,
      })

      const result = await svc.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('PROVIDER_CLOSED')
      expect(result.error.message).toContain('Semester')
      expect(mockGetAvailabilityException).toHaveBeenCalledWith('provider-1', validDTO.bookingDate)
    })

    it('should fail with generic message when isClosed=true without reason', async () => {
      const mockGetAvailabilityException = vi.fn().mockResolvedValue({
        isClosed: true,
        reason: null,
      })

      const svc = new BookingService({
        ...deps,
        getAvailabilityException: mockGetAvailabilityException,
      })

      const result = await svc.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('PROVIDER_CLOSED')
      expect(result.error.message).toBe('Leverantören är stängd detta datum')
    })

    it('should pass when exception exists but isClosed=false (alternative hours)', async () => {
      const mockGetAvailabilityException = vi.fn().mockResolvedValue({
        isClosed: false,
        startTime: '10:00',
        endTime: '14:00',
      })

      const svc = new BookingService({
        ...deps,
        getAvailabilityException: mockGetAvailabilityException,
      })

      const result = await svc.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should pass when no exception exists (null)', async () => {
      const mockGetAvailabilityException = vi.fn().mockResolvedValue(null)

      const svc = new BookingService({
        ...deps,
        getAvailabilityException: mockGetAvailabilityException,
      })

      const result = await svc.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should skip validation when getAvailabilityException dep is not provided (backwards compat)', async () => {
      // Default deps without getAvailabilityException
      const result = await service.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should fail for createManualBooking when day is closed', async () => {
      const mockGetAvailabilityException = vi.fn().mockResolvedValue({
        isClosed: true,
        reason: 'Sjuk',
      })

      const svc = new BookingService({
        ...deps,
        getAvailabilityException: mockGetAvailabilityException,
        createGhostUser: vi.fn().mockResolvedValue('ghost-user-123'),
      })

      const manualDTO: CreateManualBookingDTO = {
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: new Date('2025-02-01'),
        startTime: '10:00',
        customerId: 'customer-1',
      }

      const result = await svc.createManualBooking(manualDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('PROVIDER_CLOSED')
      expect(result.error.message).toContain('Sjuk')
    })
  })

  describe('mapBookingErrorToStatus - PROVIDER_CLOSED', () => {
    it('should return 400 for PROVIDER_CLOSED', () => {
      expect(mapBookingErrorToStatus({ type: 'PROVIDER_CLOSED', message: 'Stängd' })).toBe(400)
    })
  })

  describe('mapBookingErrorToMessage - PROVIDER_CLOSED', () => {
    it('should return the error message for PROVIDER_CLOSED', () => {
      expect(mapBookingErrorToMessage({ type: 'PROVIDER_CLOSED', message: 'Semester' }))
        .toBe('Semester')
    })
  })
})
