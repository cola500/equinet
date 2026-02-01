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

    expect(response.status).toBe(201)
    expect(data.message).toBe('Användare skapad')
    expect(data.user.email).toBe('test@example.com')
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

    expect(response.status).toBe(201)
    expect(data.message).toBe('Användare skapad')
    expect(data.user.userType).toBe('provider')
  })

  it('should return 400 if user already exists', async () => {
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

    expect(response.status).toBe(400)
    expect(data.error).toContain('email finns redan')
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
})
