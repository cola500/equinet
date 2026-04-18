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

const mockGetTotalUnreadForProvider = vi.fn()

vi.mock('@/infrastructure/persistence/conversation/PrismaConversationRepository', () => ({
  PrismaConversationRepository: class {
    getInboxForProvider = vi.fn()
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

function makeRequest() {
  return new NextRequest('http://localhost/api/provider/conversations/unread-count', { method: 'GET' })
}

// -----------------------------------------------------------
// Tests: GET /api/provider/conversations/unread-count
// -----------------------------------------------------------

describe('GET /api/provider/conversations/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(makeProviderUser() as never)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockGetTotalUnreadForProvider.mockResolvedValue(3)
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

  it('returns unread count', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.count).toBe(3)
  })

  it('returns 0 when no unread messages', async () => {
    mockGetTotalUnreadForProvider.mockResolvedValue(0)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.count).toBe(0)
  })
})
