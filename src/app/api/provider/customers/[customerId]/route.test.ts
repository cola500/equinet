import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from './route'
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    providerCustomer: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    booking: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const providerSession = {
  user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
} as any

const makeParams = (customerId: string) =>
  Promise.resolve({ customerId })

const makeRequest = () =>
  new NextRequest('http://localhost:3000/api/provider/customers/customer-1', {
    method: 'DELETE',
  })

describe('DELETE /api/provider/customers/[customerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(providerSession)
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })
    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })
    expect(response.status).toBe(403)
  })

  it('should return 404 when customer not in registry', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue(null)

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('inte')
  })

  it('should delete the ProviderCustomer link (200)', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue({
      id: 'pc-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
    } as any)
    vi.mocked(prisma.providerCustomer.delete).mockResolvedValue({} as any)
    // Ghost user with bookings -- should NOT be deleted
    vi.mocked(prisma.booking.count).mockResolvedValue(2)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'customer-1',
      isManualCustomer: true,
    } as any)

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBeDefined()
    expect(prisma.providerCustomer.delete).toHaveBeenCalled()
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('should prevent IDOR -- only provider\'s own links', async () => {
    // findUnique returns null because WHERE includes providerId
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue(null)

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })
    expect(response.status).toBe(404)

    // Verify the query used the provider's ID
    expect(prisma.providerCustomer.findUnique).toHaveBeenCalledWith({
      where: {
        providerId_customerId: {
          providerId: 'provider-1',
          customerId: 'customer-1',
        },
      },
    })
  })

  it('should also delete ghost user when no bookings exist', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue({
      id: 'pc-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
    } as any)
    vi.mocked(prisma.providerCustomer.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'customer-1',
      isManualCustomer: true,
    } as any)
    vi.mocked(prisma.user.delete).mockResolvedValue({} as any)

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })

    expect(response.status).toBe(200)
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
    })
  })

  it('should NOT delete real user (non-ghost) even with no bookings', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue({
      id: 'pc-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
    } as any)
    vi.mocked(prisma.providerCustomer.delete).mockResolvedValue({} as any)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'customer-1',
      isManualCustomer: false, // Real user
    } as any)

    const response = await DELETE(makeRequest(), { params: makeParams('customer-1') })

    expect(response.status).toBe(200)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })
})
