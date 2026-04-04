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

const mockSupabaseUpdateUserById = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1' } },
  error: null,
})

// The real createAuthService() factory uses require('@/lib/supabase/admin') which
// can't be intercepted reliably by vi.mock. Instead, mock the factory to inject deps.
vi.mock('@/domain/auth/AuthService', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/domain/auth/AuthService')>()
  return {
    ...orig,
    createAuthService: () => {
      return new orig.AuthService({
        authRepository: mockAuthRepo as never,
        supabaseAdmin: {
          createUser: vi.fn(),
          updateUserById: mockSupabaseUpdateUserById,
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

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

const VALID_PASSWORD = 'StrongP@ss1'
const VALID_TOKEN = 'abc123tokenvalue'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  })
}

function validResetToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'token-id-1',
    token: VALID_TOKEN,
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
    usedAt: null,
    userEmail: 'anna@example.com',
    userFirstName: 'Anna',
    ...overrides,
  }
}

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('POST /api/auth/reset-password (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.passwordReset).mockResolvedValue(true as never)
  })

  it('returns 200 with success message on valid reset', async () => {
    mockAuthRepo.findPasswordResetToken.mockResolvedValue(validResetToken() as never)
    mockAuthRepo.markResetTokenUsed.mockResolvedValue(undefined as never)

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toContain('Lösenordet har återställts')
    expect(mockAuthRepo.findPasswordResetToken).toHaveBeenCalledWith(VALID_TOKEN)
    // Password updated via Supabase, token marked as used in local DB
    expect(mockSupabaseUpdateUserById).toHaveBeenCalledWith('user-1', { password: VALID_PASSWORD })
    expect(mockAuthRepo.markResetTokenUsed).toHaveBeenCalledWith('token-id-1')
  })

  it('returns 400 when token not found', async () => {
    mockAuthRepo.findPasswordResetToken.mockResolvedValue(null as never)

    const res = await POST(makeRequest({ token: 'nonexistent', password: VALID_PASSWORD }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('Ogiltig eller utgången återställningslänk')
  })

  it('returns 400 when token already used', async () => {
    mockAuthRepo.findPasswordResetToken.mockResolvedValue(
      validResetToken({ usedAt: new Date() }) as never
    )

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('redan använts')
  })

  it('returns 400 when token expired', async () => {
    mockAuthRepo.findPasswordResetToken.mockResolvedValue(
      validResetToken({ expiresAt: new Date(Date.now() - 1000) }) as never
    )

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('gått ut')
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(makeInvalidJsonRequest())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('returns 400 for weak password (Zod validation)', async () => {
    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'weak' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.passwordReset).mockResolvedValue(false as never)

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }))
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.error).toContain('För många försök')
  })
})
