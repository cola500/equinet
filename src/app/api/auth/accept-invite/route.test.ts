import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerInviteToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const mockSupabaseUpdateUserById = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1' } },
  error: null,
})
const mockSupabaseCreateUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-1' } },
  error: null,
})

// The real createAuthService() factory uses require('@/lib/supabase/admin') which
// can't be intercepted reliably by vi.mock (it has 'import "server-only"', which
// throws in the test env, so supabaseAdmin silently ends up undefined). Mock the
// factory itself to inject a working supabaseAdmin instead -- same pattern as
// reset-password/route.integration.test.ts.
vi.mock('@/domain/auth/AuthService', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/domain/auth/AuthService')>()
  const { PrismaAuthRepository } = await import(
    '@/infrastructure/persistence/auth/PrismaAuthRepository'
  )
  return {
    ...orig,
    createAuthService: () =>
      new orig.AuthService({
        authRepository: new PrismaAuthRepository(),
        supabaseAdmin: {
          createUser: mockSupabaseCreateUser,
          updateUserById: mockSupabaseUpdateUserById,
        },
      }),
  }
})

import { prisma } from '@/lib/prisma'

const validPassword = 'SecurePass1!'

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost:3000/api/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify(body),
  })

const validToken = {
  id: 'token-1',
  token: 'abc123',
  userId: 'user-1',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  usedAt: null,
  user: {
    email: 'kund@example.com',
    firstName: 'Anna',
    isManualCustomer: true,
  },
}

describe('POST /api/auth/accept-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.customerInviteToken.findUnique).mockResolvedValue(validToken as never)
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as never)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/accept-invite', {
      method: 'POST',
      body: 'not-json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (no uppercase)', async () => {
    const res = await POST(makeRequest({ token: 'abc123', password: 'weakpass1!' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (no number)', async () => {
    const res = await POST(makeRequest({ token: 'abc123', password: 'WeakPass!' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (no special char)', async () => {
    const res = await POST(makeRequest({ token: 'abc123', password: 'WeakPass1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for weak password (too short)', async () => {
    const res = await POST(makeRequest({ token: 'abc123', password: 'Sh0r!' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when token does not exist', async () => {
    vi.mocked(prisma.customerInviteToken.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest({ token: 'nonexistent', password: validPassword }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is already used', async () => {
    vi.mocked(prisma.customerInviteToken.findUnique).mockResolvedValue({
      ...validToken,
      usedAt: new Date(),
    } as never)

    const res = await POST(makeRequest({ token: 'abc123', password: validPassword }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when token is expired', async () => {
    vi.mocked(prisma.customerInviteToken.findUnique).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 1000),
    } as never)

    const res = await POST(makeRequest({ token: 'abc123', password: validPassword }))
    expect(res.status).toBe(400)
  })

  it('returns 200 and upgrades user on valid token', async () => {
    const res = await POST(makeRequest({ token: 'abc123', password: validPassword }))
    expect(res.status).toBe(200)

    // The password must actually be set in Supabase Auth -- not just the DB
    // row flipped to "accepted" (that was a real bug: see AuthService.test.ts
    // "should fail instead of silently accepting when supabaseAdmin is unavailable").
    expect(mockSupabaseUpdateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ password: validPassword })
    )

    // Should use $transaction for atomicity
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('returns 500 when Supabase admin cannot set the password (fail closed, not silent success)', async () => {
    mockSupabaseUpdateUserById.mockResolvedValueOnce({ data: { user: null }, error: { message: 'down' } })
    mockSupabaseCreateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'down' } })

    const res = await POST(makeRequest({ token: 'abc123', password: validPassword }))
    expect(res.status).toBe(500)

    // The invite must not be marked used when the password was never set.
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
