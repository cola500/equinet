import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from './route'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import * as geocoding from '@/lib/geocoding'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/geocoding', () => ({
  geocodeAddress: vi.fn(),
}))

// Mock repositories
const mockFindByIdWithPublicDetails = vi.fn()
const mockFindByIdForOwner = vi.fn()
const mockUpdateWithAuth = vi.fn()

vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => {
  return {
    ProviderRepository: class {
      findByIdWithPublicDetails = mockFindByIdWithPublicDetails
      findByIdForOwner = mockFindByIdForOwner
      updateWithAuth = mockUpdateWithAuth
    },
  }
})

describe('GET /api/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return provider with services and availability', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      businessName: 'Test Hovslagare',
      description: 'Professional farrier services',
      city: 'Stockholm',
      isActive: true,
      services: [
        {
          id: 'service1',
          name: 'Hovslagning',
          price: 800,
          durationMinutes: 60,
        },
        {
          id: 'service2',
          name: 'Massage',
          price: 600,
          durationMinutes: 45,
        },
      ],
      availability: [
        {
          id: 'avail1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
        {
          id: 'avail2',
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '17:00',
          isActive: true,
        },
      ],
      user: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '0701234567',
      },
    }

    mockFindByIdWithPublicDetails.mockResolvedValue(mockProvider)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert - Behavior-based: test WHAT the API returns
    expect(response.status).toBe(200)
    expect(data.id).toBe('provider123')
    expect(data.businessName).toBe('Test Hovslagare')
    expect(data.services).toHaveLength(2)
    expect(data.availability).toHaveLength(2)
    expect(data.user.firstName).toBe('John')

    // Verify repository was called
    expect(mockFindByIdWithPublicDetails).toHaveBeenCalledWith('provider123')
  })

  it('should return 404 when provider does not exist', async () => {
    // Arrange
    mockFindByIdWithPublicDetails.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/nonexistent')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Leverantör hittades inte')
  })

  it('should return 404 when provider is not active', async () => {
    // Arrange - repository returns null for inactive providers
    mockFindByIdWithPublicDetails.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/inactive123')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'inactive123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Leverantör hittades inte')
  })

  it('should return provider with empty services array if no active services', async () => {
    // Arrange
    const mockProvider = {
      id: 'provider123',
      businessName: 'Test Provider',
      isActive: true,
      services: [],
      availability: [],
      user: { firstName: 'John', lastName: 'Doe', phone: '0701234567' },
    }

    mockFindByIdWithPublicDetails.mockResolvedValue(mockProvider)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123')

    // Act
    const response = await GET(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.services).toHaveLength(0)
    expect(data.availability).toHaveLength(0)
  })
})

describe('PUT /api/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update provider with automatic geocoding when address changes', async () => {
    // Arrange - Mock session (provider owns this profile)
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    // Mock existing provider (owner check passes)
    mockFindByIdForOwner.mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
      address: 'Old Street 1',
      city: 'Old City',
      postalCode: '11111',
      latitude: null,
      longitude: null,
    })

    // Mock successful geocoding
    vi.mocked(geocoding.geocodeAddress).mockResolvedValue({
      latitude: 57.930,
      longitude: 12.532,
    })

    // Mock successful update
    mockUpdateWithAuth.mockResolvedValue({
      id: 'provider123',
      businessName: 'Test Hovslagare',
      address: 'Storgatan 1',
      city: 'Alingsås',
      postalCode: '44130',
      latitude: 57.930,
      longitude: 12.532,
    })

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Test Hovslagare',
        address: 'Storgatan 1',
        city: 'Alingsås',
        postalCode: '44130',
      }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert - Geocoding was called with full address string
    expect(geocoding.geocodeAddress).toHaveBeenCalledWith(
      'Storgatan 1, Alingsås, 44130'
    )

    // Assert - Repository updateWithAuth was called
    expect(mockUpdateWithAuth).toHaveBeenCalledWith(
      'provider123',
      expect.objectContaining({
        businessName: 'Test Hovslagare',
        address: 'Storgatan 1',
        city: 'Alingsås',
        postalCode: '44130',
        latitude: 57.930,
        longitude: 12.532,
      }),
      'user123'
    )

    expect(response.status).toBe(200)
    expect(data.latitude).toBe(57.930)
    expect(data.longitude).toBe(12.532)
  })

  it('should NOT geocode if address unchanged', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    // Existing provider with coordinates
    mockFindByIdForOwner.mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
      address: 'Storgatan 1',
      city: 'Alingsås',
      postalCode: '44130',
      latitude: 57.930,
      longitude: 12.532,
    })

    mockUpdateWithAuth.mockResolvedValue({
      id: 'provider123',
      businessName: 'Updated Name',
      address: 'Storgatan 1',
      city: 'Alingsås',
      latitude: 57.930,
      longitude: 12.532,
    })

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'Updated Name', // Only name changed
        address: 'Storgatan 1', // Same address
        city: 'Alingsås',
        postalCode: '44130',
      }),
    })

    // Act
    await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })

    // Assert - Geocoding NOT called
    expect(geocoding.geocodeAddress).not.toHaveBeenCalled()

    // Assert - Update used existing coordinates
    expect(mockUpdateWithAuth).toHaveBeenCalledWith(
      'provider123',
      expect.objectContaining({
        latitude: 57.930,
        longitude: 12.532,
      }),
      'user123'
    )
  })

  it('should return 400 if geocoding fails', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    mockFindByIdForOwner.mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
      address: 'Old Address',
      city: null,
      postalCode: null,
      latitude: null,
      longitude: null,
    })

    // Mock geocoding failure
    vi.mocked(geocoding.geocodeAddress).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        address: 'Invalid Address XYZ 999',
        city: 'NonexistentCity',
      }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('geokoda')
  })

  it('should return 401 if not authenticated', async () => {
    // Arrange - No session
    vi.mocked(auth).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({ businessName: 'Test' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Ej inloggad')
  })

  it('should return 404 if user does not own provider profile', async () => {
    // Arrange - User authenticated but doesn't own this provider
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'otherUser', userType: 'provider' },
    } as any)

    // Repository returns null for ownership check (security: 404 not 403)
    mockFindByIdForOwner.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({ businessName: 'Test' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert - Returns 404 (not 403) for security best practice
    expect(response.status).toBe(404)
    expect(data.error).toBe('Leverantör hittades inte')
  })

  it('should return 404 if provider not found', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    mockFindByIdForOwner.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/providers/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ businessName: 'Test' }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Leverantör hittades inte')
  })

  it('should return 400 for invalid JSON body', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    mockFindByIdForOwner.mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
    })

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: 'invalid json',
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('should return 400 for validation errors', async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user123', userType: 'provider' },
    } as any)

    mockFindByIdForOwner.mockResolvedValue({
      id: 'provider123',
      userId: 'user123',
    })

    const request = new NextRequest('http://localhost:3000/api/providers/provider123', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: '', // Empty string - might be invalid
        serviceAreaKm: -10, // Negative - invalid
      }),
    })

    // Act
    const response = await PUT(request, {
      params: Promise.resolve({ id: 'provider123' }),
    })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })
})
