import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// -----------------------------------------------------------
// Mocks (must be defined before imports that use them)
// -----------------------------------------------------------

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    messageUser: vi.fn().mockResolvedValue(true),
    messageConversation: vi.fn().mockResolvedValue(true),
  },
  RateLimitServiceError: class RateLimitServiceError extends Error {
    constructor(msg: string) { super(msg); this.name = 'RateLimitServiceError' }
  },
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockCreateMessage = vi.fn()
const mockListMessages = vi.fn()
const mockFindByBookingId = vi.fn()
const mockMarkMessagesAsRead = vi.fn()
const mockGetUnreadCount = vi.fn()

vi.mock('@/infrastructure/persistence/conversation/PrismaConversationRepository', () => ({
  PrismaConversationRepository: class {
    createMessage = mockCreateMessage
    listMessages = mockListMessages
    findByBookingId = mockFindByBookingId
    markMessagesAsRead = mockMarkMessagesAsRead
    getUnreadCount = mockGetUnreadCount
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

// Import after mocks
import { GET, POST } from './route'
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
    service: { name: 'Hovslagning' },
  }
}

function makeRequest(body?: unknown, method = 'POST') {
  const url = `http://localhost/api/bookings/${BOOKING_ID}/messages`
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
}

// -----------------------------------------------------------
// Tests: POST /api/bookings/[id]/messages
// -----------------------------------------------------------

describe('POST /api/bookings/[id]/messages', () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(makeCustomerUser() as never)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockPrismaBookingFindFirst.mockResolvedValue(makeBookingRow())
    mockCreateMessage.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderType: 'CUSTOMER',
      senderId: CUSTOMER_USER_ID,
      content: 'Hej leverantör!',
      createdAt: new Date(),
      readAt: null,
    })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await POST(makeRequest({ content: 'Hej' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when messaging feature is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const res = await POST(makeRequest({ content: 'Hej' }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 404 when booking not found or not owned', async () => {
    mockPrismaBookingFindFirst.mockResolvedValue(null)
    const res = await POST(makeRequest({ content: 'Hej' }), { params })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    })
    const res = await POST(req, { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty content', async () => {
    const res = await POST(makeRequest({ content: '' }), { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing content field', async () => {
    const res = await POST(makeRequest({}), { params })
    expect(res.status).toBe(400)
  })

  it('creates message and returns 201', async () => {
    const res = await POST(makeRequest({ content: 'Hej leverantör!' }), { params })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.content).toBe('Hej leverantör!')
    expect(data.senderType).toBe('CUSTOMER')
  })

  it('returns 429 when user rate limit exceeded', async () => {
    const { rateLimiters } = await import('@/lib/rate-limit')
    vi.mocked(rateLimiters.messageUser).mockResolvedValueOnce(false)
    const res = await POST(makeRequest({ content: 'Hej' }), { params })
    expect(res.status).toBe(429)
  })
})

// -----------------------------------------------------------
// Tests: GET /api/bookings/[id]/messages
// -----------------------------------------------------------

describe('GET /api/bookings/[id]/messages', () => {
  const params = Promise.resolve({ id: BOOKING_ID })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(makeCustomerUser() as never)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockPrismaBookingFindFirst.mockResolvedValue(makeBookingRow())
    mockFindByBookingId.mockResolvedValue({ id: 'conv-1', bookingId: BOOKING_ID, createdAt: new Date(), lastMessageAt: new Date() })
    mockListMessages.mockResolvedValue({ messages: [], nextCursor: null })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const req = new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages`, { method: 'GET' })
    const res = await GET(req, { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 when messaging feature is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const req = new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages`, { method: 'GET' })
    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it('returns empty messages array when no conversation exists', async () => {
    mockFindByBookingId.mockResolvedValue(null)
    const req = new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages`, { method: 'GET' })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.messages).toEqual([])
    expect(data.nextCursor).toBeNull()
    expect(data.customerName).toBe('Anna Karlsson')
    expect(data.serviceName).toBe('Hovslagning')
  })

  it('returns messages with correct shape', async () => {
    const now = new Date()
    mockListMessages.mockResolvedValue({
      messages: [{
        id: 'msg-1',
        conversationId: 'conv-1',
        senderType: 'CUSTOMER',
        senderId: CUSTOMER_USER_ID,
        content: 'Testmeddelande',
        createdAt: now,
        readAt: null,
      }],
      nextCursor: null,
    })
    const req = new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages`, { method: 'GET' })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.messages).toHaveLength(1)
    expect(data.messages[0].senderType).toBe('CUSTOMER')
    expect(data.messages[0].isFromSelf).toBe(true)
    expect(data.customerName).toBe('Anna Karlsson')
    expect(data.serviceName).toBe('Hovslagning')
  })

  it('falls back to "Bokning" when service is null', async () => {
    mockPrismaBookingFindFirst.mockResolvedValue({ ...makeBookingRow(), service: null })
    const req = new NextRequest(`http://localhost/api/bookings/${BOOKING_ID}/messages`, { method: 'GET' })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.serviceName).toBe('Bokning')
  })
})
