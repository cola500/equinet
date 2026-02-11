import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    providerCustomerNote: {
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

const providerSession = {
  user: { id: 'user-1', userType: 'provider', providerId: 'provider-1' },
} as any

const makeParams = (customerId: string, noteId: string) =>
  Promise.resolve({ customerId, noteId })

// -----------------------------------------------------------
// DELETE /api/provider/customers/[customerId]/notes/[noteId]
// -----------------------------------------------------------
describe('DELETE /api/provider/customers/[customerId]/notes/[noteId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a note owned by the provider', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.providerCustomerNote.delete).mockResolvedValue({} as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes/note-1',
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams('customer-1', 'note-1'),
    })

    expect(response.status).toBe(204)
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes/note-1',
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams('customer-1', 'note-1'),
    })
    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes/note-1',
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams('customer-1', 'note-1'),
    })
    expect(response.status).toBe(403)
  })

  it('should return 404 when note not found or not owned', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    // Prisma throws P2025 when record not found in delete
    vi.mocked(prisma.providerCustomerNote.delete).mockRejectedValue(
      new Error('Record to delete does not exist.')
    )

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes/nonexistent',
      { method: 'DELETE' }
    )

    const response = await DELETE(request, {
      params: makeParams('customer-1', 'nonexistent'),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('hittades inte')
  })
})
