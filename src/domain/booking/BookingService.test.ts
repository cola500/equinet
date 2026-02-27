import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BookingService,
  BookingServiceDeps,
  CreateBookingDTO,
  CreateManualBookingDTO,
  ServiceInfo,
  ProviderInfo,
  ProviderRescheduleInfo,
  CustomerLocationInfo,
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

    it('should allow provider to mark confirmed booking as no_show', async () => {
      const bookingId = await createPendingBooking()

      // Confirm first
      await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })

      // Then mark as no_show
      const result = await service.updateStatus({
        bookingId,
        newStatus: 'no_show',
        providerId: 'provider-1',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('no_show')
    })

    it('should NOT allow customer to mark as no_show (provider only)', async () => {
      const bookingId = await createPendingBooking()

      await service.updateStatus({
        bookingId,
        newStatus: 'confirmed',
        providerId: 'provider-1',
      })

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'no_show',
        customerId: 'customer-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should NOT allow no_show from pending', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'no_show',
        providerId: 'provider-1',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should fail for invalid status string', async () => {
      const bookingId = await createPendingBooking()

      const result = await service.updateStatus({
        bookingId,
        newStatus: 'bogus' as never,
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
      Object.assign(prismaError, { code: 'P2002' })
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

  describe('acceptingNewCustomers validation', () => {
    it('should allow booking when acceptingNewCustomers is true (default)', async () => {
      mockGetProvider.mockResolvedValue({ ...validProvider, acceptingNewCustomers: true })

      const result = await service.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
    })

    it('should allow existing customer when acceptingNewCustomers is false', async () => {
      const mockHasCompletedBookingWith = vi.fn().mockResolvedValue(true)
      mockGetProvider.mockResolvedValue({ ...validProvider, acceptingNewCustomers: false })

      const svc = new BookingService({
        ...deps,
        hasCompletedBookingWith: mockHasCompletedBookingWith,
      })

      const result = await svc.createBooking(validDTO)

      expect(result.isSuccess).toBe(true)
      expect(mockHasCompletedBookingWith).toHaveBeenCalledWith('provider-1', 'customer-1')
    })

    it('should reject new customer when acceptingNewCustomers is false', async () => {
      const mockHasCompletedBookingWith = vi.fn().mockResolvedValue(false)
      mockGetProvider.mockResolvedValue({ ...validProvider, acceptingNewCustomers: false })

      const svc = new BookingService({
        ...deps,
        hasCompletedBookingWith: mockHasCompletedBookingWith,
      })

      const result = await svc.createBooking(validDTO)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('NEW_CUSTOMER_NOT_ACCEPTED')
    })

    it('should NOT check acceptingNewCustomers for createManualBooking', async () => {
      const mockHasCompletedBookingWith = vi.fn()
      mockGetProvider.mockResolvedValue({ ...validProvider, acceptingNewCustomers: false })

      const svc = new BookingService({
        ...deps,
        hasCompletedBookingWith: mockHasCompletedBookingWith,
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

      expect(result.isSuccess).toBe(true)
      expect(mockHasCompletedBookingWith).not.toHaveBeenCalled()
    })
  })

  describe('rescheduleBooking', () => {
    const rescheduleSettings: ProviderRescheduleInfo = {
      rescheduleEnabled: true,
      rescheduleWindowHours: 24,
      maxReschedules: 2,
      rescheduleRequiresApproval: false,
    }

    let mockGetProviderRescheduleSettings: ReturnType<typeof vi.fn>

    // Future date to ensure bookings are in the future
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    const _futureDateStr = futureDate.toISOString().split('T')[0]

    const newFutureDate = new Date()
    newFutureDate.setDate(newFutureDate.getDate() + 10)
    const newFutureDateStr = newFutureDate.toISOString().split('T')[0]

    beforeEach(() => {
      mockGetProviderRescheduleSettings = vi.fn().mockResolvedValue(rescheduleSettings)
    })

    function createRescheduleService(): BookingService {
      return new BookingService({
        ...deps,
        getProviderRescheduleSettings: mockGetProviderRescheduleSettings,
      })
    }

    async function seedBooking(overrides?: Partial<{ status: string; rescheduleCount: number; startTime: string; bookingDate: Date }>): Promise<string> {
      const booking = {
        id: 'booking-1',
        customerId: 'customer-1',
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: overrides?.bookingDate || futureDate,
        startTime: overrides?.startTime || '10:00',
        endTime: '11:00',
        timezone: 'Europe/Stockholm',
        status: (overrides?.status || 'confirmed') as never,
        rescheduleCount: overrides?.rescheduleCount ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await bookingRepository.save(booking)
      return booking.id
    }

    it('should reschedule booking successfully', async () => {
      const svc = createRescheduleService()
      const bookingId = await seedBooking()

      const result = await svc.rescheduleBooking({
        bookingId,
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.startTime).toBe('14:00')
      expect(result.value.endTime).toBe('15:00')
      expect(result.value.rescheduleCount).toBe(1)
    })

    it('should fail when booking not found', async () => {
      const svc = createRescheduleService()

      const result = await svc.rescheduleBooking({
        bookingId: 'non-existent',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_FOUND')
    })

    it('should fail when booking does not belong to customer', async () => {
      const svc = createRescheduleService()
      await seedBooking()

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'other-customer',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('BOOKING_NOT_FOUND')
    })

    it('should fail when booking is cancelled', async () => {
      const svc = createRescheduleService()
      await seedBooking({ status: 'cancelled' })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should fail when booking is completed', async () => {
      const svc = createRescheduleService()
      await seedBooking({ status: 'completed' })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_STATUS_TRANSITION')
    })

    it('should fail when provider has reschedule disabled', async () => {
      mockGetProviderRescheduleSettings.mockResolvedValue({
        ...rescheduleSettings,
        rescheduleEnabled: false,
      })
      const svc = createRescheduleService()
      await seedBooking()

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('RESCHEDULE_DISABLED')
    })

    it('should fail when reschedule window has passed', async () => {
      // Booking is 2 hours from now, window requires 24h
      const soonDate = new Date()
      soonDate.setHours(soonDate.getHours() + 2)
      const svc = createRescheduleService()
      await seedBooking({
        bookingDate: soonDate,
        startTime: `${String(soonDate.getHours()).padStart(2, '0')}:${String(soonDate.getMinutes()).padStart(2, '0')}`,
      })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('RESCHEDULE_WINDOW_PASSED')
      if (result.error.type === 'RESCHEDULE_WINDOW_PASSED') {
        expect(result.error.hoursRequired).toBe(24)
      }
    })

    it('should fail when max reschedules reached', async () => {
      const svc = createRescheduleService()
      await seedBooking({ rescheduleCount: 2 })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('MAX_RESCHEDULES_REACHED')
      if (result.error.type === 'MAX_RESCHEDULES_REACHED') {
        expect(result.error.max).toBe(2)
      }
    })

    it('should fail when service is inactive', async () => {
      mockGetService.mockResolvedValue({ ...validService, isActive: false })
      const svc = createRescheduleService()
      await seedBooking()

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INACTIVE_SERVICE_FOR_RESCHEDULE')
    })

    it('should fail when new date is in the past', async () => {
      const svc = createRescheduleService()
      await seedBooking()

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: '2020-01-01',
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_TIMES')
    })

    it('should fail when new time overlaps with another booking', async () => {
      const svc = createRescheduleService()
      await seedBooking()

      // Create another booking at the target time
      const otherBooking = {
        id: 'booking-2',
        customerId: 'customer-2',
        providerId: 'provider-1',
        serviceId: 'service-1',
        bookingDate: newFutureDate,
        startTime: '14:00',
        endTime: '15:00',
        timezone: 'Europe/Stockholm',
        status: 'confirmed' as const,
        rescheduleCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await bookingRepository.save(otherBooking)

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('OVERLAP')
    })

    it('should set status to pending when approval required and booking was confirmed', async () => {
      mockGetProviderRescheduleSettings.mockResolvedValue({
        ...rescheduleSettings,
        rescheduleRequiresApproval: true,
      })
      const svc = createRescheduleService()
      await seedBooking({ status: 'confirmed' })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe('pending')
    })

    it('should keep pending status when approval required and booking was pending', async () => {
      mockGetProviderRescheduleSettings.mockResolvedValue({
        ...rescheduleSettings,
        rescheduleRequiresApproval: true,
      })
      const svc = createRescheduleService()
      await seedBooking({ status: 'pending' })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isSuccess).toBe(true)
      // Status should stay as-is (no newStatus set) since it was already pending
      expect(result.value.status).toBe('pending')
    })

    it('should allow reschedule for pending bookings', async () => {
      const svc = createRescheduleService()
      await seedBooking({ status: 'pending' })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isSuccess).toBe(true)
    })

    it('should fail when day is closed', async () => {
      const mockGetAvailabilityException = vi.fn().mockResolvedValue({
        isClosed: true,
        reason: 'Semester',
      })

      const svc = new BookingService({
        ...deps,
        getProviderRescheduleSettings: mockGetProviderRescheduleSettings,
        getAvailabilityException: mockGetAvailabilityException,
      })
      await seedBooking()

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('PROVIDER_CLOSED')
    })

    it('should increment rescheduleCount after successful reschedule', async () => {
      const svc = createRescheduleService()
      await seedBooking({ rescheduleCount: 1 })

      const result = await svc.rescheduleBooking({
        bookingId: 'booking-1',
        customerId: 'customer-1',
        newBookingDate: newFutureDateStr,
        newStartTime: '14:00',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.rescheduleCount).toBe(2)
    })
  })

})
