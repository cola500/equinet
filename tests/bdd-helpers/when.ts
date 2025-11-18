/**
 * BDD Test Helpers - When (Actions)
 *
 * These helpers perform business actions.
 * Example: when.customerFetchesBookings() instead of GET(new NextRequest(...))
 */

import { NextRequest } from 'next/server'

export const when = {
  /**
   * When a customer fetches their bookings
   * @example
   * const response = await when.customerFetchesBookings()
   */
  customerFetchesBookings: async () => {
    // Dynamic import to avoid circular dependencies
    const { GET } = await import('@/app/api/bookings/route')
    const request = new NextRequest('http://localhost:3000/api/bookings')
    return await GET(request)
  },

  /**
   * When a customer creates a booking
   * @example
   * const response = await when.customerCreatesBooking({
   *   providerId: 'provider-123',
   *   serviceId: 'service-1',
   *   bookingDate: '2025-11-20',
   *   startTime: '10:00',
   *   endTime: '11:00'
   * })
   */
  customerCreatesBooking: async (bookingData: {
    providerId: string
    serviceId: string
    bookingDate: string
    startTime: string
    endTime: string
    horseName?: string
    horseInfo?: string
    customerNotes?: string
  }) => {
    const { POST } = await import('@/app/api/bookings/route')
    const request = new NextRequest('http://localhost:3000/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    })
    return await POST(request)
  },

  /**
   * When a user fetches their profile
   * @example
   * const response = await when.userFetchesProfile()
   */
  userFetchesProfile: async () => {
    const { GET } = await import('@/app/api/profile/route')
    const request = new NextRequest('http://localhost:3000/api/profile')
    return await GET(request)
  },

  /**
   * When a user updates their profile
   * @example
   * const response = await when.userUpdatesProfile({
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   phone: '0701234567'
   * })
   */
  userUpdatesProfile: async (profileData: {
    firstName: string
    lastName: string
    phone?: string
  }) => {
    const { PUT } = await import('@/app/api/profile/route')
    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    })
    return await PUT(request)
  },

  /**
   * When a provider creates a route
   * @example
   * const response = await when.providerCreatesRoute({
   *   routeName: 'Morning Route',
   *   routeDate: '2025-11-20T00:00:00.000Z',
   *   startTime: '09:00',
   *   orderIds: ['order-1', 'order-2']
   * })
   */
  providerCreatesRoute: async (routeData: {
    routeName: string
    routeDate: string
    startTime: string
    orderIds: string[]
  }) => {
    const { POST } = await import('@/app/api/routes/route')
    const request = new NextRequest('http://localhost:3000/api/routes', {
      method: 'POST',
      body: JSON.stringify(routeData),
    })
    return await POST(request)
  },

  /**
   * When a customer creates a route order
   * @example
   * const response = await when.customerCreatesRouteOrder({
   *   serviceType: 'hovslagning',
   *   numberOfHorses: 2,
   *   address: 'Test Street 123',
   *   city: 'Stockholm',
   *   latitude: 59.3293,
   *   longitude: 18.0686,
   *   preferredDate: '2025-11-20'
   * })
   */
  customerCreatesRouteOrder: async (orderData: {
    serviceType: string
    numberOfHorses: number
    address: string
    city: string
    latitude: number
    longitude: number
    preferredDate: string
    notes?: string
  }) => {
    const { POST } = await import('@/app/api/route-orders/route')
    const request = new NextRequest('http://localhost:3000/api/route-orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
    return await POST(request)
  },
}
