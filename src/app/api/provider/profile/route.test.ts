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
} as never

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

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
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)

    const request = new NextRequest('http://localhost:3000/api/provider/profile')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.acceptingNewCustomers).toBe(true)
  })

  it('should use select instead of include to prevent data leakage', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as never)

    const request = new NextRequest('http://localhost:3000/api/provider/profile')
    await GET(request)

    const call = vi.mocked(prisma.provider.findUnique).mock.calls[0][0]
    // Must NOT use include without top-level select (would expose vocabularyTerms etc)
    expect(call).toHaveProperty('select')
    expect(call.select).toBeDefined()
    // vocabularyTerms should NOT be selected
    if (call.select && typeof call.select === 'object') {
      expect((call.select as never).vocabularyTerms).toBeFalsy()
    }
  })

  it('should return 401 for non-provider users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)

    const request = new NextRequest('http://localhost:3000/api/provider/profile')
    const response = await GET(request)
    expect(response.status).toBe(401)
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
    } as never)

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
    } as never)

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

  it('should update reschedule settings', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.provider.update).mockResolvedValue({
      ...mockProvider,
      rescheduleEnabled: false,
      rescheduleWindowHours: 48,
      maxReschedules: 3,
      rescheduleRequiresApproval: true,
    } as never)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        rescheduleEnabled: false,
        rescheduleWindowHours: 48,
        maxReschedules: 3,
        rescheduleRequiresApproval: true,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(200)

    expect(vi.mocked(prisma.provider.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rescheduleEnabled: false,
          rescheduleWindowHours: 48,
          maxReschedules: 3,
          rescheduleRequiresApproval: true,
        }),
      })
    )
  })

  it('should reject rescheduleWindowHours outside valid range', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        rescheduleWindowHours: 0,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(400)
  })

  it('should reject maxReschedules outside valid range', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        maxReschedules: 11,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(400)
  })

  it('should update recurring booking settings', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.provider.update).mockResolvedValue({
      ...mockProvider,
      recurringEnabled: true,
      maxSeriesOccurrences: 8,
    } as never)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        recurringEnabled: true,
        maxSeriesOccurrences: 8,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(200)

    expect(vi.mocked(prisma.provider.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recurringEnabled: true,
          maxSeriesOccurrences: 8,
        }),
      })
    )
  })

  it('should reject maxSeriesOccurrences below 2', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        maxSeriesOccurrences: 1,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(400)
  })

  it('should reject maxSeriesOccurrences above 52', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest('http://localhost:3000/api/provider/profile', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        maxSeriesOccurrences: 53,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(400)
  })
})
