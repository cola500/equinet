import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// -----------------------------------------------------------
// Mocks -- repository level (AuthService runs for real)
// -----------------------------------------------------------

const mockAuthRepo = {
  findUserByEmail: vi.fn(),
  findUserForResend: vi.fn(),
  findVerificationToken: vi.fn(),
  findPasswordResetToken: vi.fn(),
  createUser: vi.fn(),
  createProvider: vi.fn(),
  createVerificationToken: vi.fn(),
  verifyEmail: vi.fn(),
  invalidatePasswordResetTokens: vi.fn(),
  createPasswordResetToken: vi.fn(),
  markResetTokenUsed: vi.fn(),
  upgradeGhostUser: vi.fn(),
  updateUserType: vi.fn(),
}

vi.mock('@/infrastructure/persistence/auth/PrismaAuthRepository', () => ({
  PrismaAuthRepository: class MockPrismaAuthRepository {
    findUserByEmail = mockAuthRepo.findUserByEmail
    findUserForResend = mockAuthRepo.findUserForResend
    findVerificationToken = mockAuthRepo.findVerificationToken
    findPasswordResetToken = mockAuthRepo.findPasswordResetToken
    createUser = mockAuthRepo.createUser
    createProvider = mockAuthRepo.createProvider
    createVerificationToken = mockAuthRepo.createVerificationToken
    verifyEmail = mockAuthRepo.verifyEmail
    invalidatePasswordResetTokens = mockAuthRepo.invalidatePasswordResetTokens
    createPasswordResetToken = mockAuthRepo.createPasswordResetToken
    markResetTokenUsed = mockAuthRepo.markResetTokenUsed
    upgradeGhostUser = mockAuthRepo.upgradeGhostUser
    updateUserType = mockAuthRepo.updateUserType
  },
}))

// The real createAuthService() factory uses require('@/lib/supabase/admin') which
// can't be intercepted reliably by vi.mock. Instead, mock the factory to inject deps.
vi.mock('@/domain/auth/AuthService', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/domain/auth/AuthService')>()
  const email = await import('@/lib/email')
  return {
    ...orig,
    createAuthService: () => {
      return new orig.AuthService({
        authRepository: mockAuthRepo as never,
        emailService: {
          sendVerification: email.sendEmailVerificationNotification,
          sendPasswordReset: email.sendPasswordResetNotification,
        },
      })
    },
  }
})

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { passwordReset: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/email', () => ({
  sendPasswordResetNotification: vi.fn().mockResolvedValue(undefined),
  sendEmailVerificationNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// -----------------------------------------------------------
// Imports (after mocks)
// -----------------------------------------------------------

import { POST } from './route'
import { rateLimiters } from '@/lib/rate-limit'
import { sendPasswordResetNotification } from '@/lib/email'

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

const GENERIC_MESSAGE =
  'Om e-postadressen finns i vårt system har vi skickat en länk för att återställa ditt lösenord.'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  })
}

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('POST /api/auth/forgot-password (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.passwordReset).mockResolvedValue(true as never)
  })

  it('returns 200 with generic message and sends email when user exists', async () => {
    mockAuthRepo.findUserForResend.mockResolvedValue({
      id: 'user-1',
      firstName: 'Anna',
      email: 'anna@example.com',
      emailVerified: true,
    } as never)
    mockAuthRepo.invalidatePasswordResetTokens.mockResolvedValue(undefined as never)
    mockAuthRepo.createPasswordResetToken.mockResolvedValue(undefined as never)

    const res = await POST(makeRequest({ email: 'ANNA@example.com' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe(GENERIC_MESSAGE)
    expect(mockAuthRepo.findUserForResend).toHaveBeenCalledWith('anna@example.com')
    expect(mockAuthRepo.invalidatePasswordResetTokens).toHaveBeenCalledWith('user-1')
    expect(mockAuthRepo.createPasswordResetToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    )
    expect(sendPasswordResetNotification).toHaveBeenCalled()
  })

  it('returns 200 with same generic message when user not found (anti-enumeration)', async () => {
    mockAuthRepo.findUserForResend.mockResolvedValue(null as never)

    const res = await POST(makeRequest({ email: 'nobody@example.com' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe(GENERIC_MESSAGE)
    expect(mockAuthRepo.invalidatePasswordResetTokens).not.toHaveBeenCalled()
    expect(mockAuthRepo.createPasswordResetToken).not.toHaveBeenCalled()
    expect(sendPasswordResetNotification).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonRequest())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.passwordReset).mockResolvedValue(false as never)

    const res = await POST(makeRequest({ email: 'anna@example.com' }))
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.error).toContain('För många försök')
  })
})
