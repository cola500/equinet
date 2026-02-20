import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from './route'
import * as authServer from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    availability: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe('GET /api/providers/[id]/availability-schedule', () => {
  const mockProviderId = 'provider-123'
  const _mockUserId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return availability schedule for a provider', async () => {
    const mockAvailability = [
      {
        id: '1',
        providerId: mockProviderId,
        dayOfWeek: 0, // Måndag
        startTime: '09:00',
        endTime: '17:00',
        isClosed: false,
        isActive: true,
      },
      {
        id: '2',
        providerId: mockProviderId,
        dayOfWeek: 1, // Tisdag
        startTime: '09:00',
        endTime: '17:00',
        isClosed: false,
        isActive: true,
      },
      {
        id: '3',
        providerId: mockProviderId,
        dayOfWeek: 2, // Onsdag
        startTime: '00:00',
        endTime: '00:00',
        isClosed: true,
        isActive: true,
      },
    ]

    vi.mocked(prisma.availability.findMany).mockResolvedValue(mockAvailability as any)

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`)
    const response = await GET(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual(mockAvailability)
    expect(prisma.availability.findMany).toHaveBeenCalledWith({
      where: {
        providerId: mockProviderId,
        isActive: true,
      },
      orderBy: {
        dayOfWeek: 'asc',
      },
    })
  })

  it('should return empty array if no availability set', async () => {
    vi.mocked(prisma.availability.findMany).mockResolvedValue([])

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`)
    const response = await GET(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual([])
  })
})

describe('PUT /api/providers/[id]/availability-schedule', () => {
  const mockProviderId = 'provider-123'
  const mockUserId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update availability schedule for authenticated provider', async () => {
    const mockSession = {
      user: { id: mockUserId, userType: 'provider', providerId: mockProviderId },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const scheduleData = [
      { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isClosed: false },
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isClosed: false },
      { dayOfWeek: 2, startTime: '00:00', endTime: '00:00', isClosed: true },
    ]

    const mockUpdatedAvailability = scheduleData.map((item, i) => ({
      id: `avail-${i}`,
      providerId: mockProviderId,
      ...item,
      isActive: true,
    }))

    // Mock $transaction to execute the callback and return the result
    // @ts-expect-error - Vitest type instantiation depth limitation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx = {
        availability: {
          deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue(mockUpdatedAvailability),
        },
      }
      return callback(tx)
    })

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedule: scheduleData }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
    const data = await response.json()
    expect(data).toHaveLength(3)
  })

  it('should return 401 if not authenticated', async () => {
    // auth() throws Response when not authenticated
    vi.mocked(authServer.auth).mockRejectedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedule: [] }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(401)
  })

  it('should return 403 if not a provider', async () => {
    const mockSession = {
      user: { id: mockUserId, userType: 'customer' },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedule: [] }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(403)
  })

  it('should return 403 if provider ID does not match session', async () => {
    const mockSession = {
      user: { id: mockUserId, userType: 'provider', providerId: 'different-provider' },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    // Mock that the provider is owned by a DIFFERENT user
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: 'different-user-id',  // Different user owns this provider
    } as any)

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedule: [] }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(403)
  })

  it('should validate schedule data', async () => {
    const mockSession = {
      user: { id: mockUserId, userType: 'provider', providerId: mockProviderId },
    }
    vi.mocked(authServer.auth).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
      userId: mockUserId,
    } as any)

    const invalidSchedule = [
      { dayOfWeek: 8, startTime: '09:00', endTime: '17:00', isClosed: false }, // Invalid dayOfWeek
    ]

    const request = new Request(`http://localhost/api/providers/${mockProviderId}/availability-schedule`, {
      method: 'PUT',
      body: JSON.stringify({ schedule: invalidSchedule }),
    })

    const response = await PUT(request, {
      params: Promise.resolve({ id: mockProviderId }),
    })

    expect(response.status).toBe(400)
  })
})
