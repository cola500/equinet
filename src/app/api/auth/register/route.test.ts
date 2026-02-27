import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import { Result } from '@/domain/shared'

// Mock AuthService
const mockRegister = vi.fn()
vi.mock('@/domain/auth/AuthService', () => ({
  createAuthService: () => ({
    register: mockRegister,
  }),
}))

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    registration: vi.fn(() => true),
  },
}))

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new customer successfully', async () => {
    mockRegister.mockResolvedValue(
      Result.ok({
        user: {
          id: '123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          userType: 'customer',
        },
      })
    )

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Security: generic response to prevent email enumeration
    expect(response.status).toBe(200)
    expect(data.message).toBe('Om registreringen lyckades skickas ett verifieringsmail till din email.')
    expect(data.user).toBeUndefined()
  })

  it('should register a new provider with business info', async () => {
    mockRegister.mockResolvedValue(
      Result.ok({
        user: {
          id: '456',
          email: 'provider@example.com',
          firstName: 'Provider',
          lastName: 'User',
          userType: 'provider',
        },
      })
    )

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'provider@example.com',
        password: 'Password123!',
        firstName: 'Provider',
        lastName: 'User',
        userType: 'provider',
        businessName: 'Test Business',
        description: 'Test description',
        city: 'Stockholm',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Security: generic response to prevent email enumeration
    expect(response.status).toBe(200)
    expect(data.message).toBe('Om registreringen lyckades skickas ett verifieringsmail till din email.')
    expect(data.user).toBeUndefined()
  })

  it('should return generic 200 when email already exists (prevents enumeration)', async () => {
    mockRegister.mockResolvedValue(
      Result.fail({
        type: 'EMAIL_ALREADY_EXISTS',
        message: 'En anvandare med denna email finns redan',
      })
    )

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    // Security: identical response to successful registration
    expect(response.status).toBe(200)
    expect(data.message).toBe('Om registreringen lyckades skickas ett verifieringsmail till din email.')
    expect(data.error).toBeUndefined()
  })

  it('should return identical response for new and existing email', async () => {
    // First: successful registration
    mockRegister.mockResolvedValueOnce(
      Result.ok({
        user: { id: '123', email: 'new@example.com', firstName: 'New', lastName: 'User', userType: 'customer' },
      })
    )

    const successRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const successResponse = await POST(successRequest)
    const successData = await successResponse.json()

    // Second: existing email
    mockRegister.mockResolvedValueOnce(
      Result.fail({
        type: 'EMAIL_ALREADY_EXISTS',
        message: 'En anvandare med denna email finns redan',
      })
    )

    const existingRequest = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const existingResponse = await POST(existingRequest)
    const existingData = await existingResponse.json()

    // Security: responses must be indistinguishable
    expect(successResponse.status).toBe(existingResponse.status)
    expect(successData).toEqual(existingData)
  })

  it('should return 400 for invalid email', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for short password', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: '12345', // too short
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid userType', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        userType: 'invalid',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 429 when rate limited', async () => {
    const { rateLimiters } = await import('@/lib/rate-limit')
    vi.mocked(rateLimiters.registration).mockResolvedValueOnce(false)

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('För många')
  })

  it('should return 500 on unexpected error', async () => {
    mockRegister.mockRejectedValue(new Error('Database connection lost'))

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('Något gick fel')
  })

  it('should return 400 for invalid JSON body', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: 'not valid json{{{',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })
})
