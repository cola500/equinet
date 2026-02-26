import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Note: isValidMunicipality is NOT mocked -- we use the real implementation
// so we can test that invalid municipalities are properly rejected.

const customerSession = {
  user: { id: 'user-1', userType: 'customer' },
} as never

const mockUserWithProvider = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Anna',
  lastName: 'Andersson',
  phone: '070-1234567',
  userType: 'provider',
  city: 'Stockholm',
  address: 'Storgatan 1',
  municipality: 'Stockholm',
  latitude: 59.3293,
  longitude: 18.0686,
  provider: { id: 'provider-1' },
}

const mockUserWithoutProvider = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Anna',
  lastName: 'Andersson',
  phone: '070-1234567',
  userType: 'customer',
  city: 'Göteborg',
  address: null,
  municipality: 'Göteborg',
  latitude: null,
  longitude: null,
  provider: null,
}

// ---------- GET ----------

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const authError = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    )
    vi.mocked(auth).mockRejectedValue(authError)

    const request = new NextRequest('http://localhost:3000/api/profile')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/profile')
    const response = await GET(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('User not found')
  })

  it('returns profile with provider data and flattened providerId', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithProvider as never)

    const request = new NextRequest('http://localhost:3000/api/profile')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.providerId).toBe('provider-1')
    expect(data.firstName).toBe('Anna')
    expect(data.lastName).toBe('Andersson')
    expect(data.email).toBe('test@example.com')
    expect(data.city).toBe('Stockholm')
    expect(data.latitude).toBe(59.3293)
    expect(data.longitude).toBe(18.0686)
    // provider object should be flattened -- the nested object should not be present
    expect(data.provider).toBeUndefined()
  })

  it('returns profile without provider (customer) with providerId null', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithoutProvider as never)

    const request = new NextRequest('http://localhost:3000/api/profile')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.providerId).toBeNull()
    expect(data.userType).toBe('customer')
    expect(data.provider).toBeUndefined()
  })

  it('returns 500 on unexpected error and logs it', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB down'))

    const request = new NextRequest('http://localhost:3000/api/profile')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Kunde inte hämta profil')
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching profile',
      expect.any(Error)
    )
  })
})

// ---------- PUT ----------

describe('PUT /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const authError = new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    )
    vi.mocked(auth).mockRejectedValue(authError)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName: 'Anna', lastName: 'Andersson' }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: 'not-valid-json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PUT(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Ogiltig JSON')
    expect(data.details).toBe('Förfrågan måste innehålla giltig JSON')
  })

  it('returns 400 for Zod validation error (missing required fields)', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName: '' }), // missing lastName, firstName empty
    })
    const response = await PUT(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Valideringsfel')
    expect(data.details).toBeDefined()
    expect(Array.isArray(data.details)).toBe(true)
  })

  it('.strict() rejects extra/unknown fields', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Anna',
        lastName: 'Andersson',
        unknownField: 'should-be-rejected',
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Valideringsfel')
  })

  it('returns 400 for invalid municipality', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Anna',
        lastName: 'Andersson',
        municipality: 'FakeCity123',
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Valideringsfel')
    // Check that the specific municipality validation message is present
    const municipalityIssue = data.details.find(
      (d: { path?: string[]; message?: string }) => d.path?.includes('municipality')
    )
    expect(municipalityIssue).toBeDefined()
    expect(municipalityIssue.message).toBe('Ogiltig kommun')
  })

  it('updates profile successfully (happy path)', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    const updatedUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Britta',
      lastName: 'Bengtsson',
      phone: '070-9999999',
      userType: 'customer',
      city: 'Malmö',
      address: 'Lilla gatan 5',
      municipality: 'Malmö',
      latitude: null,
      longitude: null,
    }
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Britta',
        lastName: 'Bengtsson',
        phone: '070-9999999',
        city: 'Malmö',
        address: 'Lilla gatan 5',
        municipality: 'Malmö',
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.firstName).toBe('Britta')
    expect(data.lastName).toBe('Bengtsson')
    expect(data.city).toBe('Malmö')

    // Verify prisma.user.update was called with session user id
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          firstName: 'Britta',
          lastName: 'Bengtsson',
        }),
      })
    )
  })

  it('updates geo fields (latitude, longitude)', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    const updatedUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Anna',
      lastName: 'Andersson',
      phone: null,
      userType: 'customer',
      city: null,
      address: null,
      municipality: null,
      latitude: 57.7089,
      longitude: 11.9746,
    }
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Anna',
        lastName: 'Andersson',
        latitude: 57.7089,
        longitude: 11.9746,
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.latitude).toBe(57.7089)
    expect(data.longitude).toBe(11.9746)

    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          latitude: 57.7089,
          longitude: 11.9746,
        }),
      })
    )
  })

  it('returns 500 on unexpected error and logs it', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    vi.mocked(prisma.user.update).mockRejectedValue(new Error('DB write failed'))

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Anna',
        lastName: 'Andersson',
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Kunde inte uppdatera profil')
    expect(logger.error).toHaveBeenCalledWith(
      'Error updating profile',
      expect.any(Error)
    )
  })

  it('does not allow updating email or password via .strict()', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Anna',
        lastName: 'Andersson',
        email: 'hacker@evil.com',
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Valideringsfel')
    // prisma.user.update should NOT have been called
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('response shape includes all expected profile fields', async () => {
    vi.mocked(auth).mockResolvedValue(customerSession)
    const updatedUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Anna',
      lastName: 'Andersson',
      phone: '070-1234567',
      userType: 'customer',
      city: 'Uppsala',
      address: 'Svartbäcksgatan 10',
      municipality: 'Uppsala',
      latitude: 59.8586,
      longitude: 17.6389,
    }
    vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as never)

    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Anna',
        lastName: 'Andersson',
        phone: '070-1234567',
        city: 'Uppsala',
        address: 'Svartbäcksgatan 10',
        municipality: 'Uppsala',
        latitude: 59.8586,
        longitude: 17.6389,
      }),
    })
    const response = await PUT(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    // Verify all expected fields are present
    const expectedKeys = [
      'id', 'email', 'firstName', 'lastName', 'phone',
      'userType', 'city', 'address', 'municipality',
      'latitude', 'longitude',
    ]
    for (const key of expectedKeys) {
      expect(data).toHaveProperty(key)
    }

    // Verify no unexpected fields leak (e.g. passwordHash)
    expect(data.passwordHash).toBeUndefined()
    expect(data.provider).toBeUndefined()
  })
})
