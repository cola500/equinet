import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { NextRequest, NextResponse } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

// Mock repositories
const mockUpdateWithAuth = vi.fn()
const mockDeleteWithAuth = vi.fn()
const mockFindByUserId = vi.fn()

vi.mock('@/infrastructure/persistence/service/ServiceRepository', () => {
  return {
    ServiceRepository: class {
      updateWithAuth = mockUpdateWithAuth
      deleteWithAuth = mockDeleteWithAuth
    },
  }
})

vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => {
  return {
    ProviderRepository: class {
      findByUserId = mockFindByUserId
    },
  }
})

describe('PUT /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update service when authorized', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
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

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    mockUpdateWithAuth.mockResolvedValue(mockUpdatedService)

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

    // Assert - Behavior-based: test WHAT the API returns
    expect(response.status).toBe(200)
    expect(data.name).toBe('Hovslagning')
    expect(data.price).toBe(800)

    // Verify repository was called with correct auth context
    expect(mockUpdateWithAuth).toHaveBeenCalledWith(
      'service1',
      {
        name: 'Hovslagning',
        description: 'Updated description',
        price: 800,
        durationMinutes: 60,
        isActive: true,
      },
      'provider123'
    )
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange - auth() throws Response when not authenticated
    vi.mocked(auth).mockRejectedValue(
      NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    )

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
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 401 when user is not a provider', async () => {
    // Arrange - customer trying to update a service
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'customer' },
    } as any)

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
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 404 when provider profile not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(null)

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
    expect(data.error).toBe('Provider not found')
  })

  it('should return 404 when service does not exist', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns null when service not found or unauthorized
    mockUpdateWithAuth.mockResolvedValue(null)

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
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns null for unauthorized access
    mockUpdateWithAuth.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Test', price: 100, durationMinutes: 30 }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) because atomic auth doesn't distinguish
    expect(response.status).toBe(404)
    expect(data.error).toBe('Service not found')
  })

  it('should return 400 for invalid data', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)

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
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid JSON body', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'PUT',
      body: 'invalid json',
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })
})

describe('DELETE /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete service when authorized', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    mockDeleteWithAuth.mockResolvedValue(true)

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

    // Verify repository was called with correct auth context
    expect(mockDeleteWithAuth).toHaveBeenCalledWith('service1', 'provider123')
  })

  it('should return 401 when user is not authenticated', async () => {
    // Arrange - auth() throws Response when not authenticated
    vi.mocked(auth).mockRejectedValue(
      NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
    )

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
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 401 when user is not a provider', async () => {
    // Arrange - customer trying to delete a service
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'customer' },
    } as any)

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
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 404 when provider profile not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(null)

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
    expect(data.error).toBe('Provider not found')
  })

  it('should return 404 when service does not exist', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns false when service not found
    mockDeleteWithAuth.mockResolvedValue(false)

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
    const mockProvider = {
      id: 'provider123',
      userId: 'user123',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue(mockProvider)
    // Repository returns false for unauthorized access
    mockDeleteWithAuth.mockResolvedValue(false)

    const request = new NextRequest('http://localhost:3000/api/services/service1', {
      method: 'DELETE',
    })

    // Act
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'service1' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) because atomic auth
    expect(response.status).toBe(404)
    expect(data.error).toBe('Service not found')
  })
})
