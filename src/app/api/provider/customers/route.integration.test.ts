/**
 * Integration smoke test for GET /api/provider/customers
 *
 * Full API behavior is covered by route.test.ts (14 GET + 10 POST tests: auth,
 * filtering, search, manually added customers, deduplication, horses).
 * This file is the migration anchor for customer-registry.spec.ts (S43-2).
 *
 * Coverage-gap (UI, framtida component-test):
 * - Expanderbart kundkort (klick -> expansion)
 * - Sökfält-UI och filterknapp-rendering
 * - Mobile/desktop-layout skillnader (booking count hidden on mobile)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetAuthUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockPrisma: {
    provider: { findUnique: vi.fn() },
    booking: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    providerCustomer: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  },
}))

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: mockGetAuthUser,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/ghost-user', () => ({
  createGhostUser: vi.fn().mockResolvedValue('new-ghost-id'),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeString: vi.fn((s: string) => s),
  sanitizePhone: vi.fn((s: string) => s),
  sanitizeEmail: vi.fn((s: string) => s),
  stripXss: vi.fn((s: string) => s),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_USER_ID = 'a0000000-0000-4000-a000-000000000001'
const PROVIDER_ID = 'a0000000-0000-4000-a000-000000000002'
const CUSTOMER_ID = 'a0000000-0000-4000-a000-000000000003'

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/provider/customers')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return new NextRequest(url.toString())
}

function makeProviderAuth() {
  return {
    id: PROVIDER_USER_ID,
    email: 'provider@example.com',
    userType: 'provider',
    isAdmin: false,
    providerId: PROVIDER_ID,
    stableId: null,
    authMethod: 'supabase' as const,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/provider/customers (integration smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(makeProviderAuth())
    mockPrisma.provider.findUnique.mockResolvedValue({ id: PROVIDER_ID })
    mockPrisma.booking.groupBy.mockResolvedValue([])
    mockPrisma.booking.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.providerCustomer.findMany.mockResolvedValue([])
  })

  it('returns 401 when not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it('returns 404 when provider profile not found', async () => {
    mockPrisma.provider.findUnique.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(404)
  })

  it('returns 200 with empty list when provider has no customers', async () => {
    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.customers).toEqual([])
  })

  it('returns customers with correct structure from completed bookings', async () => {
    mockPrisma.booking.groupBy.mockResolvedValueOnce([
      { customerId: CUSTOMER_ID, _count: { id: 3 }, _max: { bookingDate: new Date('2026-01-01') } },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: CUSTOMER_ID, firstName: 'Test', lastName: 'Testsson', email: 'test@example.com', phone: null },
    ])

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.customers).toHaveLength(1)
    expect(data.customers[0]).toMatchObject({
      id: CUSTOMER_ID,
      firstName: 'Test',
      lastName: 'Testsson',
      email: 'test@example.com',
      bookingCount: 3,
    })
  })
})
