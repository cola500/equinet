import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// -----------------------------------------------------------
// Hoisted mock objects (vi.mock factories are hoisted to top)
// -----------------------------------------------------------

const {
  mockSupabaseServerClient,
  mockAnonClient,
  mockAdminClient,
  mockRateLimiters,
} = vi.hoisted(() => {
  const mockSupabaseServerClient = { auth: { getUser: vi.fn() } }
  const mockAnonClient = { auth: { signInWithPassword: vi.fn() } }
  const mockAdminClient = { auth: { admin: { updateUserById: vi.fn() } } }
  const mockRateLimiters = { passwordReset: vi.fn() }
  return { mockSupabaseServerClient, mockAnonClient, mockAdminClient, mockRateLimiters }
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockSupabaseServerClient),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue(mockAnonClient),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: mockRateLimiters,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// -----------------------------------------------------------
// Import route after mocks
// -----------------------------------------------------------

import { POST } from './route'

const mockUser = { id: 'supabase-user-1', email: 'test@example.com' }

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimiters.passwordReset.mockResolvedValue(true)
    mockSupabaseServerClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
    mockAnonClient.auth.signInWithPassword.mockResolvedValue({ error: null })
    mockAdminClient.auth.admin.updateUserById.mockResolvedValue({ error: null })
  })

  it('returns 401 when not authenticated', async () => {
    mockSupabaseServerClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const res = await POST(makeRequest({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    }))

    expect(res.status).toBe(401)
  })

  it('returns 401 when current password is wrong', async () => {
    mockAnonClient.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })

    const res = await POST(makeRequest({
      currentPassword: 'WrongPass1!',
      newPassword: 'NewPass1!',
    }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('lösenord')
    expect(mockAdminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('returns 200 and calls updateUserById when credentials are correct', async () => {
    const res = await POST(makeRequest({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    }))

    expect(res.status).toBe(200)
    expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      'supabase-user-1',
      { password: 'NewPass1!' }
    )
  })

  it('returns 400 when new password does not meet requirements', async () => {
    const res = await POST(makeRequest({
      currentPassword: 'OldPass1!',
      newPassword: 'weak',
    }))

    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited (auth passes, rate limit blocks)', async () => {
    mockRateLimiters.passwordReset.mockResolvedValue(false)

    const res = await POST(makeRequest({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    }))

    expect(res.status).toBe(429)
    expect(mockAdminClient.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
