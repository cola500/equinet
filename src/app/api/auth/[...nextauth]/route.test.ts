import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock rate-limit module
const mockLoginIp = vi.fn()
const mockGetClientIP = vi.fn()

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    loginIp: mockLoginIp,
  },
  getClientIP: mockGetClientIP,
}))

// Mock NextAuth handlers
const mockPost = vi.fn()
vi.mock('@/lib/auth', () => ({
  handlers: {
    GET: vi.fn(),
    POST: mockPost,
  },
}))

// Import AFTER mocks
const { POST } = await import('./route')

function createRequest(pathname: string, ip: string = '192.168.1.1') {
  return new NextRequest(`http://localhost:3000/api/auth${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-real-ip': ip,
    },
  })
}

describe('POST /api/auth/[...nextauth]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClientIP.mockReturnValue('192.168.1.1')
    mockLoginIp.mockResolvedValue(true)
    mockPost.mockResolvedValue(new Response('OK', { status: 200 }))
  })

  describe('IP-based rate limiting on /callback/credentials', () => {
    it('returns 429 when IP rate limit is exhausted', async () => {
      mockLoginIp.mockResolvedValue(false)

      const request = createRequest('/callback/credentials')
      const response = await POST(request)

      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body.error).toContain('många inloggningsförsök')
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('passes request to NextAuth when within IP rate limit', async () => {
      mockLoginIp.mockResolvedValue(true)

      const request = createRequest('/callback/credentials')
      await POST(request)

      expect(mockLoginIp).toHaveBeenCalledWith('192.168.1.1')
      expect(mockPost).toHaveBeenCalledWith(request)
    })

    it('extracts IP using getClientIP', async () => {
      mockGetClientIP.mockReturnValue('10.0.0.42')

      const request = createRequest('/callback/credentials')
      await POST(request)

      expect(mockGetClientIP).toHaveBeenCalledWith(request)
      expect(mockLoginIp).toHaveBeenCalledWith('10.0.0.42')
    })
  })

  describe('non-credentials paths', () => {
    it('does NOT rate limit /signout', async () => {
      const request = createRequest('/signout')
      await POST(request)

      expect(mockLoginIp).not.toHaveBeenCalled()
      expect(mockPost).toHaveBeenCalledWith(request)
    })

    it('does NOT rate limit /callback/google', async () => {
      const request = createRequest('/callback/google')
      await POST(request)

      expect(mockLoginIp).not.toHaveBeenCalled()
      expect(mockPost).toHaveBeenCalledWith(request)
    })

    it('does NOT rate limit /session', async () => {
      const request = createRequest('/session')
      await POST(request)

      expect(mockLoginIp).not.toHaveBeenCalled()
      expect(mockPost).toHaveBeenCalledWith(request)
    })
  })
})
