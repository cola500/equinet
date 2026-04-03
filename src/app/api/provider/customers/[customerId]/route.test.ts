import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE, PUT } from './route'
import { getAuthUser } from '@/lib/auth-dual'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: vi.fn(),
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
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const providerAuthUser = {
  id: 'user-1', email: '', userType: 'provider', isAdmin: false,
  providerId: 'provider-1', stableId: null, authMethod: 'nextauth' as const,
}

const makeDeleteRequest = (customerId: string) =>
  new NextRequest(`http://localhost:3000/api/provider/customers/${customerId}`, {
    method: 'DELETE',
  })

const makePutRequest = (customerId: string, body: Record<string, unknown>) =>
  new NextRequest(`http://localhost:3000/api/provider/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

describe('DELETE /api/provider/customers/[customerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue(providerAuthUser)
  })

  it('should return 401 when session is null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest('customer-1'))
    expect(response.status).toBe(401)
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest('customer-1'))
    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not a provider', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: 'user-1', email: '', userType: 'customer', isAdmin: false,
      providerId: null, stableId: null, authMethod: 'nextauth' as const,
    })

    const response = await DELETE(makeDeleteRequest('customer-1'))
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.error).toBe('Åtkomst nekad')
  })

  it('should return 404 when customer not in registry', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest('customer-1'))
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('inte')
  })

  it('should delete the ProviderCustomer link (200)', async () => {
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue({
      id: 'pc-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
    } as never)
    vi.mocked(prisma.providerCustomer.delete).mockResolvedValue({} as never)
    // Ghost user with bookings -- should NOT be deleted
    vi.mocked(prisma.booking.count).mockResolvedValue(2)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'customer-1',
      isManualCustomer: true,
    } as never)

    const response = await DELETE(makeDeleteRequest('customer-1'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBeDefined()
    expect(prisma.providerCustomer.delete).toHaveBeenCalled()
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('should prevent IDOR -- only provider\'s own links', async () => {
    // findUnique returns null because WHERE includes providerId
    vi.mocked(prisma.providerCustomer.findUnique).mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest('customer-1'))
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
    } as never)
    vi.mocked(prisma.providerCustomer.delete).mockResolvedValue({} as never)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'customer-1',
      isManualCustomer: true,
    } as never)
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never)

    const response = await DELETE(makeDeleteRequest('customer-1'))

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
    } as never)
    vi.mocked(prisma.providerCustomer.delete).mockResolvedValue({} as never)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'customer-1',
      isManualCustomer: false, // Real user
    } as never)

    const response = await DELETE(makeDeleteRequest('customer-1'))

    expect(response.status).toBe(200)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })
})

describe('PUT /api/provider/customers/[customerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue(providerAuthUser)
  })

  it('should return 401 when session is null', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const response = await PUT(makePutRequest('customer-1', { firstName: 'Anna' }))
    expect(response.status).toBe(401)
  })
})
