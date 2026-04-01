import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthUser } from '@/infrastructure/persistence/auth/IAuthRepository'

// ---------------------------------------------------------------------------
// Mocks -- only boundaries, NOT createAuthService (the real AuthService runs)
// ---------------------------------------------------------------------------

const mockAuthRepo = {
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  createProvider: vi.fn(),
  createVerificationToken: vi.fn(),
  upgradeGhostUser: vi.fn(),
  findUserWithCredentials: vi.fn(),
  findUserForResend: vi.fn(),
  findVerificationToken: vi.fn(),
  verifyEmail: vi.fn(),
  createPasswordResetToken: vi.fn(),
  findPasswordResetToken: vi.fn(),
  invalidatePasswordResetTokens: vi.fn(),
  resetPassword: vi.fn(),
}

vi.mock('@/infrastructure/persistence/auth/PrismaAuthRepository', () => ({
  PrismaAuthRepository: class MockPrismaAuthRepository {
    findUserByEmail = mockAuthRepo.findUserByEmail
    createUser = mockAuthRepo.createUser
    createProvider = mockAuthRepo.createProvider
    createVerificationToken = mockAuthRepo.createVerificationToken
    upgradeGhostUser = mockAuthRepo.upgradeGhostUser
    findUserWithCredentials = mockAuthRepo.findUserWithCredentials
    findUserForResend = mockAuthRepo.findUserForResend
    findVerificationToken = mockAuthRepo.findVerificationToken
    verifyEmail = mockAuthRepo.verifyEmail
    createPasswordResetToken = mockAuthRepo.createPasswordResetToken
    findPasswordResetToken = mockAuthRepo.findPasswordResetToken
    invalidatePasswordResetTokens = mockAuthRepo.invalidatePasswordResetTokens
    resetPassword = mockAuthRepo.resetPassword
  },
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password-123'),
    compare: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    registration: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('@/lib/email', () => ({
  sendEmailVerificationNotification: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    body: 'not valid json{{{',
  })
}

const validCustomerBody = {
  email: 'customer@example.com',
  password: 'Password123!',
  firstName: 'Anna',
  lastName: 'Svensson',
  userType: 'customer',
}

const validProviderBody = {
  email: 'provider@example.com',
  password: 'Password123!',
  firstName: 'Erik',
  lastName: 'Johansson',
  userType: 'provider',
  businessName: 'Eriks Hovvård',
  description: 'Professionell hovvård',
  city: 'Stockholm',
}

const fakeUser: AuthUser = {
  id: 'a0000000-0000-4000-a000-000000000001',
  email: 'customer@example.com',
  firstName: 'Anna',
  lastName: 'Svensson',
  userType: 'customer',
}

const GENERIC_MESSAGE =
  'Om registreringen lyckades skickas ett verifieringsmail till din email.'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/register (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: no existing user
    mockAuthRepo.findUserByEmail.mockResolvedValue(null)
    mockAuthRepo.createUser.mockResolvedValue(fakeUser as never)
    mockAuthRepo.createProvider.mockResolvedValue(undefined as never)
    mockAuthRepo.createVerificationToken.mockResolvedValue(undefined as never)
    mockAuthRepo.upgradeGhostUser.mockResolvedValue(fakeUser as never)
  })

  // -------------------------------------------------------------------------
  // 1. Successful customer registration
  // -------------------------------------------------------------------------

  it('creates user and verification token for new customer', async () => {
    const response = await POST(makeRequest(validCustomerBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe(GENERIC_MESSAGE)

    // Real AuthService called the repository
    expect(mockAuthRepo.findUserByEmail).toHaveBeenCalledWith('customer@example.com')
    expect(mockAuthRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        passwordHash: 'hashed-password-123',
        firstName: 'Anna',
        lastName: 'Svensson',
        userType: 'customer',
      })
    )
    expect(mockAuthRepo.createVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: fakeUser.id,
        token: expect.any(String),
        expiresAt: expect.any(Date),
      })
    )
    // Customer should NOT create a provider profile
    expect(mockAuthRepo.createProvider).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 2. Successful provider registration
  // -------------------------------------------------------------------------

  it('creates user, provider and verification token for new provider', async () => {
    const providerUser: AuthUser = { ...fakeUser, email: 'provider@example.com', userType: 'provider' }
    mockAuthRepo.createUser.mockResolvedValue(providerUser as never)

    const response = await POST(makeRequest(validProviderBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe(GENERIC_MESSAGE)

    expect(mockAuthRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'provider@example.com',
        userType: 'provider',
      })
    )
    expect(mockAuthRepo.createProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: providerUser.id,
        businessName: 'Eriks Hovvård',
        description: 'Professionell hovvård',
        city: 'Stockholm',
      })
    )
    expect(mockAuthRepo.createVerificationToken).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // 3. Email already exists (non-ghost) -- anti-enumeration
  // -------------------------------------------------------------------------

  it('returns generic 200 when email already exists (non-ghost)', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue({
      id: 'existing-user-id',
      isManualCustomer: false,
    } as never)

    const response = await POST(makeRequest(validCustomerBody))
    const data = await response.json()

    // Anti-enumeration: same status and message as success
    expect(response.status).toBe(200)
    expect(data.message).toBe(GENERIC_MESSAGE)
    expect(data.error).toBeUndefined()

    // Must NOT create a new user
    expect(mockAuthRepo.createUser).not.toHaveBeenCalled()
    expect(mockAuthRepo.upgradeGhostUser).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 4. Ghost user upgrade
  // -------------------------------------------------------------------------

  it('upgrades ghost user instead of creating new user', async () => {
    const ghostUserId = 'ghost-user-id'
    mockAuthRepo.findUserByEmail.mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: true,
    } as never)
    mockAuthRepo.upgradeGhostUser.mockResolvedValue({
      ...fakeUser,
      id: ghostUserId,
    } as never)

    const response = await POST(makeRequest(validCustomerBody))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe(GENERIC_MESSAGE)

    // Should upgrade, not create
    expect(mockAuthRepo.upgradeGhostUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ghostUserId,
        passwordHash: 'hashed-password-123',
        firstName: 'Anna',
        lastName: 'Svensson',
      })
    )
    expect(mockAuthRepo.createUser).not.toHaveBeenCalled()
    expect(mockAuthRepo.createVerificationToken).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // 5. Invalid JSON
  // -------------------------------------------------------------------------

  it('returns 400 for invalid JSON body', async () => {
    const response = await POST(makeInvalidJsonRequest())
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })

  // -------------------------------------------------------------------------
  // 6. Zod validation failure
  // -------------------------------------------------------------------------

  it('returns 400 for invalid email (Zod validation)', async () => {
    const response = await POST(
      makeRequest({
        ...validCustomerBody,
        email: 'not-an-email',
      })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
    expect(data.details).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // 7. Rate limited
  // -------------------------------------------------------------------------

  it('returns 429 when rate limited', async () => {
    const { rateLimiters } = await import('@/lib/rate-limit')
    vi.mocked(rateLimiters.registration).mockResolvedValueOnce(false)

    const response = await POST(makeRequest(validCustomerBody))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('För många')

    // Should not reach the service at all
    expect(mockAuthRepo.findUserByEmail).not.toHaveBeenCalled()
  })
})
