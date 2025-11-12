import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { NextRequest } from 'next/server'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    provider: {
      create: vi.fn(),
    },
  },
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}))

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    registration: vi.fn(() => true), // Always allow in tests
  },
}))

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new customer successfully', async () => {
    // Arrange
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      userType: 'customer',
      passwordHash: 'hashed_password',
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any)

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

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(201)
    expect(data.message).toBe('Användare skapad')
    expect(data.user.email).toBe('test@example.com')
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        phone: undefined,
        userType: 'customer',
      },
    })
  })

  it('should register a new provider with business info', async () => {
    // Arrange
    const mockUser = {
      id: '456',
      email: 'provider@example.com',
      firstName: 'Provider',
      lastName: 'User',
      userType: 'provider',
      passwordHash: 'hashed_password',
    }

    const mockProvider = {
      id: '789',
      userId: '456',
      businessName: 'Test Business',
      description: 'Test description',
      city: 'Stockholm',
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.provider.create).mockResolvedValue(mockProvider as any)

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

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(201)
    expect(data.message).toBe('Användare skapad')
    expect(prisma.provider.create).toHaveBeenCalledWith({
      data: {
        userId: '456',
        businessName: 'Test Business',
        description: 'Test description',
        city: 'Stockholm',
      },
    })
  })

  it('should return 400 if user already exists', async () => {
    // Arrange
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: '123',
      email: 'existing@example.com',
    } as any)

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

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('En användare med denna email finns redan')
  })

  it('should return 400 for invalid email', async () => {
    // Arrange
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

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for short password', async () => {
    // Arrange
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

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for invalid userType', async () => {
    // Arrange
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        userType: 'invalid', // invalid type
      }),
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })
})
