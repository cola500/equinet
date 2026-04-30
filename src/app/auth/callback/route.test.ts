import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSupabaseClient } = vi.hoisted(() => {
  const mockSupabaseClient = {
    auth: { exchangeCodeForSession: vi.fn() },
  }
  return { mockSupabaseClient }
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

import { GET } from './route'

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/auth/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({ error: null })
  })

  it('exchanges code for session and redirects to /provider/dashboard', async () => {
    const res = await GET(makeRequest({ code: 'valid-code-123' }))

    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-code-123')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/provider/dashboard')
  })

  it('redirects to /login with error when no code param', async () => {
    const res = await GET(makeRequest({}))

    expect(mockSupabaseClient.auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
    expect(res.headers.get('location')).toContain('error=')
  })

  it('redirects to /login with error when exchangeCodeForSession fails', async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: 'Token expired' },
    })

    const res = await GET(makeRequest({ code: 'expired-code' }))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
    expect(res.headers.get('location')).toContain('error=')
  })
})
