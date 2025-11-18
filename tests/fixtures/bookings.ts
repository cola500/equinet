/**
 * Booking Fixtures
 *
 * These fixtures represent business entities for bookings.
 * Use them in BDD tests instead of creating inline objects.
 *
 * @example
 * given.existingBookings([pendingBooking(), confirmedBooking()])
 */

export const pendingBooking = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || 'booking-123',
  customerId: overrides.customerId || 'customer-123',
  providerId: overrides.providerId || 'provider-123',
  serviceId: overrides.serviceId || 'service-123',
  bookingDate: overrides.bookingDate || new Date('2025-11-20'),
  startTime: overrides.startTime || '10:00',
  endTime: overrides.endTime || '11:00',
  status: 'pending',
  horseName: overrides.horseName || 'Thunder',
  horseInfo: overrides.horseInfo || 'Calm horse',
  customerNotes: overrides.customerNotes || null,
  createdAt: overrides.createdAt || new Date('2025-11-15'),
  updatedAt: overrides.updatedAt || new Date('2025-11-15'),

  // Relations
  provider: overrides.provider || {
    id: overrides.providerId || 'provider-123',
    businessName: 'Test Hovslagare AB',
    user: {
      firstName: 'John',
      lastName: 'Doe',
    },
  },
  service: overrides.service || {
    id: overrides.serviceId || 'service-123',
    name: 'Hovslagning',
    price: 800,
  },
  customer: overrides.customer || {
    id: overrides.customerId || 'customer-123',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '0701234567',
  },

  ...overrides,
})

export const confirmedBooking = (overrides: Record<string, any> = {}) =>
  pendingBooking({
    ...overrides,
    status: 'confirmed',
  })

export const completedBooking = (overrides: Record<string, any> = {}) =>
  pendingBooking({
    ...overrides,
    status: 'completed',
    bookingDate: new Date('2025-10-01'), // Past date
  })

export const cancelledBooking = (overrides: Record<string, any> = {}) =>
  pendingBooking({
    ...overrides,
    status: 'cancelled',
  })

export const pastBooking = (overrides: Record<string, any> = {}) =>
  pendingBooking({
    ...overrides,
    bookingDate: new Date('2025-10-01'),
    status: 'completed',
  })

export const futureBooking = (overrides: Record<string, any> = {}) =>
  pendingBooking({
    ...overrides,
    bookingDate: new Date('2025-12-01'),
    status: 'pending',
  })

/**
 * Booking with specific time (for overlap testing)
 */
export const bookingAt = (
  date: string,
  startTime: string,
  endTime: string,
  overrides: Record<string, any> = {}
) =>
  pendingBooking({
    ...overrides,
    bookingDate: new Date(date),
    startTime,
    endTime,
  })
