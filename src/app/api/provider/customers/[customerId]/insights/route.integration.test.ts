/**
 * Integration smoke test for POST /api/provider/customers/[customerId]/insights
 *
 * Full API behavior is covered by route.test.ts (10 tests: auth, rate-limit,
 * cache, AI generation, error paths). This file is the migration anchor for
 * customer-insights.spec.ts (S43-2), which tested UI interaction in the browser
 * (button visibility, loading state, VIP badge rendering — all UI-level gaps).
 *
 * Coverage-gap (UI, framtida component-test):
 * - "Visa insikter"-knapp synlig i expanderat kundkort
 * - Laddningstext "Analyserar kunddata" visas vid anrop
 * - VIP-badge (VIP/Stamkund/Normal) renderas korrekt
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFindByUserId, mockHasCustomerRelationship, mockGenerateInsight } = vi.hoisted(() => ({
  mockFindByUserId: vi.fn(),
  mockHasCustomerRelationship: vi.fn(),
  mockGenerateInsight: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { ai: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

vi.mock('@/lib/customer-relationship', () => ({
  hasCustomerRelationship: (...args: unknown[]) => mockHasCustomerRelationship(...args),
}))

vi.mock('@/domain/customer-insight/CustomerInsightService', () => ({
  CustomerInsightService: class {
    generateInsight = mockGenerateInsight
  },
  mapInsightErrorToStatus: () => 500,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findMany: vi.fn().mockResolvedValue([]) },
    providerCustomerNote: { findMany: vi.fn().mockResolvedValue([]) },
    review: { findMany: vi.fn().mockResolvedValue([]) },
    customerReview: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/cache/customer-insights-cache', () => ({
  getCachedInsight: vi.fn().mockResolvedValue(null),
  setCachedInsight: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST } from './route'
import { auth } from '@/lib/auth-server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_ID = 'a0000000-0000-4000-a000-000000000001'
const CUSTOMER_ID = 'a0000000-0000-4000-a000-000000000002'

const MOCK_INSIGHT = {
  frequency: 'Regelbunden (var 8:e vecka)',
  topServices: ['Hovslagning Standard'],
  patterns: ['Bokar på förmiddagen'],
  riskFlags: [],
  vipScore: 'vip',
  summary: 'Stamkund med regelbundna bokningar och hög lojalitet.',
  confidence: 0.9,
}

function makeRequest() {
  return new NextRequest(
    `http://localhost/api/provider/customers/${CUSTOMER_ID}/insights`,
    { method: 'POST' }
  )
}

const params = Promise.resolve({ customerId: CUSTOMER_ID })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/provider/customers/[customerId]/insights (integration smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'provider', providerId: PROVIDER_ID },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: PROVIDER_ID })
    mockHasCustomerRelationship.mockResolvedValue(true)
    mockGenerateInsight.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: MOCK_INSIGHT,
    })
  })

  it('returns 200 with insight and metrics on happy path', async () => {
    const res = await POST(makeRequest(), { params })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.insight).toBeDefined()
    expect(data.insight.vipScore).toBe('vip')
    expect(data.metrics).toBeDefined()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await POST(makeRequest(), { params })

    expect(res.status).toBe(401)
  })

  it('returns 403 when no customer relationship', async () => {
    mockHasCustomerRelationship.mockResolvedValue(false)

    const res = await POST(makeRequest(), { params })

    expect(res.status).toBe(403)
  })
})
