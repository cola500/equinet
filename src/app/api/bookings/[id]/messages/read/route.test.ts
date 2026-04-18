import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// -----------------------------------------------------------
// Mocks
// -----------------------------------------------------------

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    messageUser: vi.fn().mockResolvedValue(true),
  },
  RateLimitServiceError: class RateLimitServiceError extends Error {
    constructor(msg: string) { super(msg); this.name = 'RateLimitServiceError' }
  },
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockMarkMessagesAsRead = vi.fn()
const mockFindByBookingId = vi.fn()

vi.mock('@/infrastructure/persistence/conversation/PrismaConversationRepository', () => ({
  PrismaConversationRepository: class {
    createMessage = vi.fn()
    listMessages = vi.fn()
    findByBookingId = mockFindByBookingId
    markMessagesAsRead = mockMarkMessagesAsRead
    getUnreadCount = vi.fn()
    findById = vi.fn()
    findMany = vi.fn()
    save = vi.fn()
    delete = vi.fn()
    exists = vi.fn()
  },
}))

const { mockPrismaBookingFindFirst } = vi.hoisted(() => ({
  mockPrismaBookingFindFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findFirst: mockPrismaBookingFindFirst },
  },
}))

import { PATCH } from './route'
import { getAuthUser } from '@/lib/auth-dual'
import { isFeatureEnabled } from '@/lib/feature-flags'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// -----------------------------------------------------------
// Fixtures
// -----------------------------------------------------------

const BOOKING_ID = 'booking-abc-123'
const CUSTOMER_USER_ID = 'customer-user-111'
const PROVIDER_USER_ID = 'provider-user-222'
const PROVIDER_ID = 'provider-333'

function makeCustomerUser() {
  return { id: CUSTOMER_USER_ID, userType: 'customer' as const, email: 'kund@test.se', providerId: null }
}

function makeBookingRow() {
  return {
    id: BOOKING_ID,
    customerId: CUSTOMER_USER_ID,
    providerId: PROVIDER_ID,
    status: 'confirmed',
    bookingDate: new Date('2026-04-20'),
    provider: {
      id: PROVIDER_ID,
      businessName: 'Hovslageri AB',
      user: { id: PROVIDER_USER_ID },
    },
    customer: { firstName: 'Anna', lastName: 'Karlsson' },
  }
}

function makeRequest() {
  return new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages/read`, {
    method: 'PATCH',
  })
}

// -----------------------------------------------------------
// Tests: PATCH /api/bookings/[id]/messages/read
// -----------------------------------------------------------

describe('PATCH /api/bookings/[id]/messages/read', () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(makeCustomerUser() as never)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockPrismaBookingFindFirst.mockResolvedValue(makeBookingRow())
    mockFindByBookingId.mockResolvedValue({
      id: 'conv-1',
      bookingId: BOOKING_ID,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    })
    mockMarkMessagesAsRead.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await PATCH(makeRequest(), { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when messaging feature is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const res = await PATCH(makeRequest(), { params })
    expect(res.status).toBe(404)
  })

  it('returns 404 when booking not found', async () => {
    mockPrismaBookingFindFirst.mockResolvedValue(null)
    const res = await PATCH(makeRequest(), { params })
    expect(res.status).toBe(404)
  })

  it('returns 200 with 0 marked when no conversation exists', async () => {
    mockFindByBookingId.mockResolvedValue(null)
    const res = await PATCH(makeRequest(), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.marked).toBe(0)
  })

  it('marks messages as read and returns 200 for customer', async () => {
    const res = await PATCH(makeRequest(), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.marked).toBeGreaterThanOrEqual(0)
    expect(mockMarkMessagesAsRead).toHaveBeenCalledWith('conv-1', 'CUSTOMER')
  })
})
