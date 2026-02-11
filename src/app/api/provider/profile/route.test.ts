import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/cache/provider-cache', () => ({
  invalidateProviderCache: vi.fn().mockResolvedValue(undefined),
}))

const providerSession = {
  user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
} as any

const mockProvider = {
  id: 'provider-1',
  userId: 'user-1',
  businessName: 'Test Hovslagare',
  description: 'Bra hovslagare',
  acceptingNewCustomers: true,
  user: {
    firstName: 'Test',
    lastName: 'Testsson',
    email: 'test@example.com',
    phone: '070-1234567',
  },
}

describe('GET /api/provider/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return provider profile with acceptingNewCustomers', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)

    const request = new NextRequest('http://localhost:3000/api/provider/profile')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.acceptingNewCustomers).toBe(true)
  })
})

describe('PUT /api/provider/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update acceptingNewCustomers to false', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.provider.update).mockResolvedValue({
      ...mockProvider,
      acceptingNewCustomers: false,
    } as any)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        acceptingNewCustomers: false,
      }),
    })

    const response = await PUT(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.acceptingNewCustomers).toBe(false)
    expect(vi.mocked(prisma.provider.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptingNewCustomers: false,
        }),
      })
    )
  })

  it('should update acceptingNewCustomers to true', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.provider.update).mockResolvedValue({
      ...mockProvider,
      acceptingNewCustomers: true,
    } as any)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        acceptingNewCustomers: true,
      }),
    })

    const response = await PUT(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.acceptingNewCustomers).toBe(true)
  })

  it('should reject invalid acceptingNewCustomers value', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        acceptingNewCustomers: 'not-a-boolean',
      }),
    })

    const response = await PUT(request)

    expect(response.status).toBe(400)
  })
})
