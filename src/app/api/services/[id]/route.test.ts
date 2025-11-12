import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('PUT /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update service when authorized', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockExistingService = {
      id: 'service1',
      name: 'Old Name',
      price: 500,
      durationMinutes: 30,
      providerId: 'provider123',
    }

    const mockUpdatedService = {
      id: 'service1',
      name: 'Hovslagning',
      description: 'Updated description',
      price: 800,
      durationMinutes: 60,
      isActive: true,
      providerId: 'provider123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockExistingService as any)
    vi.mocked(prisma.service.update).mockResolvedValue(mockUpdatedService as any)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Hovslagning',
        description: 'Updated description',
        price: 800,
        durationMinutes: 60,
        isActive: true,
      }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.name).toBe('Hovslagning')
    expect(data.price).toBe(800)
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: 'service1' },
      data: {
        name: 'Hovslagning',
        description: 'Updated description',
        price: 800,
        durationMinutes: 60,
        isActive: true,
      },
    })
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test', price: 100, durationMinutes: 30 }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 when service does not exist', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test', price: 100, durationMinutes: 30 }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Service not found')
  })

  it('should return 404 when service belongs to different provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockExistingService = {
      id: 'service1',
      name: 'Service',
      providerId: 'different-provider', // Different provider!
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockExistingService as any)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test', price: 100, durationMinutes: 30 }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Service not found')
  })

  it('should return 400 for invalid data', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockExistingService = {
      id: 'service1',
      providerId: 'provider123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockExistingService as any)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'PUT',
      body: JSON.stringify({ name: '', price: -100, durationMinutes: 0 }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })
})

describe('DELETE /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete service when authorized', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockExistingService = {
      id: 'service1',
      name: 'Hovslagning',
      providerId: 'provider123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockExistingService as any)
    vi.mocked(prisma.service.delete).mockResolvedValue(mockExistingService as any)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.message).toBe('Service deleted')
    expect(prisma.service.delete).toHaveBeenCalledWith({
      where: { id: 'service1' },
    })
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 when service does not exist', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services/nonexistent', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Service not found')
  })

  it('should return 404 when service belongs to different provider', async () => {
    // Arrange
    const mockSession = {
      user: {
        id: 'user123',
        userType: 'provider',
      },
    }

    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    const mockExistingService = {
      id: 'service1',
      name: 'Service',
      providerId: 'different-provider',
    }

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(mockProvider as any)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(mockExistingService as any)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Service not found')
  })
})
