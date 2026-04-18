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
    api: vi.fn().mockResolvedValue(true),
  },
  RateLimitServiceError: class RateLimitServiceError extends Error {
    constructor(msg: string) { super(msg); this.name = 'RateLimitServiceError' }
  },
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockGetInboxForProvider = vi.fn()
const mockGetTotalUnreadForProvider = vi.fn()

vi.mock('@/infrastructure/persistence/conversation/PrismaConversationRepository', () => ({
  PrismaConversationRepository: class {
    getInboxForProvider = mockGetInboxForProvider
    getTotalUnreadForProvider = mockGetTotalUnreadForProvider
    findById = vi.fn()
    findMany = vi.fn()
    save = vi.fn()
    delete = vi.fn()
    exists = vi.fn()
    findByBookingId = vi.fn()
    createMessage = vi.fn()
    listMessages = vi.fn()
    markMessagesAsRead = vi.fn()
    getUnreadCount = vi.fn()
  },
}))

// Import after mocks
import { GET } from './route'
import { getAuthUser } from '@/lib/auth-dual'
import { isFeatureEnabled } from '@/lib/feature-flags'

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// -----------------------------------------------------------
// Fixtures
// -----------------------------------------------------------

const PROVIDER_USER_ID = 'provider-user-111'

function makeProviderUser() {
  return { id: PROVIDER_USER_ID, userType: 'provider' as const, email: 'lev@test.se', providerId: 'prov-1' }
}

function makeInboxItems() {
  return [
    {
      bookingId: 'booking-1',
      bookingDate: new Date('2026-04-20'),
      serviceName: 'Hovslagning',
      customerName: 'Anna Karlsson',
      lastMessageContent: 'Hej, stämmer tid?',
      lastMessageSenderType: 'CUSTOMER' as const,
      lastMessageAt: new Date('2026-04-18T10:00:00Z'),
      unreadCount: 1,
    },
  ]
}

function makeRequest() {
  return new NextRequest('http://localhost/api/provider/conversations', { method: 'GET' })
}

// -----------------------------------------------------------
// Tests: GET /api/provider/conversations
// -----------------------------------------------------------

describe('GET /api/provider/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(makeProviderUser() as never)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockGetInboxForProvider.mockResolvedValue(makeInboxItems())
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 404 when messaging feature is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it('returns 403 when caller is not a provider', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'c1', userType: 'customer', email: 'k@test.se', providerId: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns inbox items with correct shape', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    const item = data.items[0]
    expect(item.bookingId).toBe('booking-1')
    expect(item.serviceName).toBe('Hovslagning')
    expect(item.customerName).toBe('Anna Karlsson')
    expect(item.lastMessageContent).toBe('Hej, stämmer tid?')
    expect(item.unreadCount).toBe(1)
    expect(typeof item.lastMessageAt).toBe('string') // serialized ISO
  })

  it('returns empty items array when provider has no conversations', async () => {
    mockGetInboxForProvider.mockResolvedValue([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toEqual([])
  })
})
