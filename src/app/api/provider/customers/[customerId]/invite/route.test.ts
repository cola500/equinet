import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
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
    },
    customerInviteToken: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendCustomerInviteNotification: vi.fn().mockResolvedValue({ success: true }),
}))

import { isFeatureEnabled } from '@/lib/feature-flags'

const TEST_UUIDS = {
  providerUser: 'a1111111-1111-4111-a111-111111111111',
  provider: 'a2222222-2222-4222-a222-222222222222',
  customer: 'a3333333-3333-4333-a333-333333333333',
}

const makeRequest = () =>
  new NextRequest('http://localhost:3000/api/provider/customers/cust-1/invite', {
    method: 'POST',
  })

const routeContext = { params: Promise.resolve({ customerId: TEST_UUIDS.customer }) }

describe('POST /api/provider/customers/[customerId]/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    // Default: authenticated provider
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: TEST_UUIDS.providerUser,
        userType: 'provider',
        providerId: TEST_UUIDS.provider,
      },
    } as never)

    // Default: customer exists in register
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue({
      id: 'link-1',
      providerId: TEST_UUIDS.provider,
      customerId: TEST_UUIDS.customer,
    } as never)

    // Default: ghost user with real email
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.customer,
      email: 'kund@example.com',
      firstName: 'Anna',
      isManualCustomer: true,
    } as never)

    // Default: provider with business name
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
      businessName: 'Hovservice AB',
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(new Response(null, { status: 401 }))

    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: 'customer' },
    } as never)

    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(403)
  })

  it('returns 404 when feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(404)
    expect(isFeatureEnabled).toHaveBeenCalledWith('customer_invite')
  })

  it('returns 404 when customer is not in provider register', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it('returns 409 when customer already has a real account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.customer,
      email: 'kund@example.com',
      firstName: 'Anna',
      isManualCustomer: false,
    } as never)

    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(409)
  })

  it('returns 400 when customer has sentinel email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: TEST_UUIDS.customer,
      email: 'manual-abc123@ghost.equinet.se',
      firstName: 'Anna',
      isManualCustomer: true,
    } as never)

    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(400)
  })

  it('returns 200 and creates token for valid ghost with real email', async () => {
    const res = await POST(makeRequest(), routeContext)
    expect(res.status).toBe(200)

    expect(prisma.customerInviteToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: TEST_UUIDS.customer,
        invitedByProviderId: TEST_UUIDS.provider,
      }),
    })
  })

  it('invalidates old tokens before creating new one', async () => {
    await POST(makeRequest(), routeContext)

    expect(prisma.customerInviteToken.updateMany).toHaveBeenCalledWith({
      where: { userId: TEST_UUIDS.customer, usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })
})
