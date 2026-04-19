import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// -----------------------------------------------------------
// Mocks
// -----------------------------------------------------------

const { mockPrismaUser } = vi.hoisted(() => ({
  mockPrismaUser: { update: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { user: mockPrismaUser },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

// -----------------------------------------------------------
// Imports (after mocks)
// -----------------------------------------------------------

import { GET } from './route'
import { generateUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { rateLimiters } from '@/lib/rate-limit'

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

const USER_ID = 'a0000000-0000-4000-a000-000000000001'

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/email/unsubscribe')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString())
}

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('GET /api/email/unsubscribe (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiters.api).mockResolvedValue(true as never)
    process.env.NEXTAUTH_SECRET = 'test-secret-for-vitest'
  })

  it('returns 200 HTML with success message for valid token', async () => {
    mockPrismaUser.update.mockResolvedValue({} as never)
    const token = generateUnsubscribeToken(USER_ID)

    const res = await GET(makeRequest({ userId: USER_ID, token }))
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(text).toContain('Du har avregistrerad dig')
    expect(text).toContain('bokningspåminnelser')
    expect(text).toContain('Tillbaka till Equinet')
    expect(mockPrismaUser.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { emailRemindersEnabled: false },
    })
  })

  it('returns 400 HTML with error for invalid token', async () => {
    const res = await GET(makeRequest({ userId: USER_ID, token: 'invalid-token-12345' }))
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toContain('Ogiltig eller utgången länk')
    expect(mockPrismaUser.update).not.toHaveBeenCalled()
  })

  it('returns 400 HTML with error for missing parameters', async () => {
    const res = await GET(makeRequest())
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toContain('Ogiltig länk')
    expect(mockPrismaUser.update).not.toHaveBeenCalled()
  })

  it('returns 400 HTML with error when userId is missing', async () => {
    const token = generateUnsubscribeToken(USER_ID)

    const res = await GET(makeRequest({ token }))
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toContain('Ogiltig länk')
    expect(mockPrismaUser.update).not.toHaveBeenCalled()
  })

  it('returns 400 HTML with error when token is missing', async () => {
    const res = await GET(makeRequest({ userId: USER_ID }))
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toContain('Ogiltig länk')
    expect(mockPrismaUser.update).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimiters.api).mockResolvedValue(false as never)
    const token = generateUnsubscribeToken(USER_ID)

    const res = await GET(makeRequest({ userId: USER_ID, token }))
    const text = await res.text()

    expect(res.status).toBe(429)
    expect(text).toContain('För många förfrågningar')
    expect(mockPrismaUser.update).not.toHaveBeenCalled()
  })
})
