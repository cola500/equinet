import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    providerCustomer: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { isFeatureEnabled } from '@/lib/feature-flags'
import { prisma } from '@/lib/prisma'

const TEST_UUIDS = {
  providerUser: 'a1111111-1111-4111-a111-111111111111',
  provider: 'a2222222-2222-4222-a222-222222222222',
  ghostCustomer: 'a3333333-3333-4333-a333-333333333333',
  realCustomer: 'a4444444-4444-4444-a444-444444444444',
}

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost:3000/api/provider/customers/ghost-1/merge', {
    method: 'POST',
    body: JSON.stringify(body),
  })

const routeContext = { params: Promise.resolve({ customerId: TEST_UUIDS.ghostCustomer }) }

describe('POST /api/provider/customers/[customerId]/merge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    vi.mocked(auth).mockResolvedValue({
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
        providerId: TEST_UUIDS.provider,
      },
    } as never)

    // Default: ghost user exists in register
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue({
      id: 'link-1',
    } as never)

    // Default: ghost user
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ghostCustomer,
      email: 'ghost@ghost.equinet.se',
      isManualCustomer: true,
    } as never)

    // Default: real user found by email
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: TEST_UUIDS.realCustomer,
      email: 'real@example.com',
      isManualCustomer: false,
    } as never)

    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never)
  })

  it('returns 403 when not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'customer' },
    } as never)

    const res = await POST(makeRequest({ targetEmail: 'real@example.com' }), routeContext)
    expect(res.status).toBe(403)
  })

  it('returns 404 when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const res = await POST(makeRequest({ targetEmail: 'real@example.com' }), routeContext)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/provider/customers/ghost-1/merge', {
      method: 'POST',
      body: 'not-json',
    })

    const res = await POST(req, routeContext)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email', async () => {
    const res = await POST(makeRequest({ targetEmail: 'not-an-email' }), routeContext)
    expect(res.status).toBe(400)
  })

  it('returns 404 when ghost not in provider register', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest({ targetEmail: 'real@example.com' }), routeContext)
    expect(res.status).toBe(404)
  })

  it('returns 409 when customer is not a ghost', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.ghostCustomer,
      email: 'not-ghost@example.com',
      isManualCustomer: false,
    } as never)

    const res = await POST(makeRequest({ targetEmail: 'real@example.com' }), routeContext)
    expect(res.status).toBe(409)
  })

  it('returns 404 when target user not found', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const res = await POST(makeRequest({ targetEmail: 'real@example.com' }), routeContext)
    expect(res.status).toBe(404)
  })

  it('returns 200 and executes merge on valid request', async () => {
    const res = await POST(makeRequest({ targetEmail: 'real@example.com' }), routeContext)
    expect(res.status).toBe(200)

    expect(prisma.$transaction).toHaveBeenCalled()
  })
})
