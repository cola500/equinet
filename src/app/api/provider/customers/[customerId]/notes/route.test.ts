import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { auth } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      count: vi.fn(),
    },
    providerCustomer: {
      count: vi.fn(),
    },
    providerCustomerNote: {
      findMany: vi.fn(),
      create: vi.fn(),
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

const makeParams = (customerId: string) =>
  Promise.resolve({ customerId })

// -----------------------------------------------------------
// GET /api/provider/customers/[customerId]/notes
// -----------------------------------------------------------
describe('GET /api/provider/customers/[customerId]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return notes for a valid provider-customer pair', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(1)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([
      {
        id: 'note-1',
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: 'Behöver extra tid',
        createdAt: new Date('2026-02-10'),
      },
    ] as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes'
    )

    const response = await GET(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notes).toHaveLength(1)
    expect(data.notes[0].content).toBe('Behöver extra tid')
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes'
    )

    const response = await GET(request, { params: makeParams('customer-1') })
    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes'
    )

    const response = await GET(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('leverantör')
  })

  it('should return 403 when no completed booking with customer', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(0)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes'
    )

    const response = await GET(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('relation')
  })

  it('should allow notes for manually added customer (no booking)', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(1)
    vi.mocked(prisma.providerCustomerNote.findMany).mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes'
    )

    const response = await GET(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.notes).toEqual([])
  })
})

// -----------------------------------------------------------
// POST /api/provider/customers/[customerId]/notes
// -----------------------------------------------------------
describe('POST /api/provider/customers/[customerId]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a note for a valid customer', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(1)
    vi.mocked(prisma.providerCustomerNote.create).mockResolvedValue({
      id: 'note-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
      content: 'Ny anteckning',
      createdAt: new Date(),
    } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Ny anteckning' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.content).toBe('Ny anteckning')
    expect(data.providerId).toBe('provider-1')
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Test' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    expect(response.status).toBe(401)
  })

  it('should return 403 when user is not a provider', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Test' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    expect(response.status).toBe(403)
  })

  it('should return 400 for invalid JSON', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: 'invalid json',
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Ogiltig JSON')
  })

  it('should return 400 for empty content', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should return 400 for content exceeding 2000 characters', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'a'.repeat(2001) }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Valideringsfel')
  })

  it('should reject extra fields (strict mode)', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test',
          providerId: 'hacked-provider', // Should be rejected
        }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    expect(response.status).toBe(400)
  })

  it('should return 403 when no customer relationship exists', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(0)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Test' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('relation')
  })

  it('should allow creating notes for manually added customer', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(0)
    vi.mocked(prisma.providerCustomer.count).mockResolvedValue(1)
    vi.mocked(prisma.providerCustomerNote.create).mockResolvedValue({
      id: 'note-1',
      providerId: 'provider-1',
      customerId: 'customer-1',
      content: 'Manuell kund-anteckning',
      createdAt: new Date(),
    } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Manuell kund-anteckning' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    expect(response.status).toBe(201)
  })

  it('should sanitize content (strip XSS)', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(1)
    vi.mocked(prisma.providerCustomerNote.create).mockImplementation(
      async (args: any) => ({
        id: 'note-1',
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: args.data.content,
        createdAt: new Date(),
      })
    )

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: '<script>alert("xss")</script>Safe text' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.content).not.toContain('<script>')
    expect(data.content).toContain('Safe text')
  })

  it('should preserve newlines in content', async () => {
    vi.mocked(auth).mockResolvedValue(providerSession)
    vi.mocked(prisma.booking.count).mockResolvedValue(1)
    vi.mocked(prisma.providerCustomerNote.create).mockImplementation(
      async (args: any) => ({
        id: 'note-1',
        providerId: 'provider-1',
        customerId: 'customer-1',
        content: args.data.content,
        createdAt: new Date(),
      })
    )

    const request = new NextRequest(
      'http://localhost:3000/api/provider/customers/customer-1/notes',
      {
        method: 'POST',
        body: JSON.stringify({ content: 'Line 1\nLine 2' }),
      }
    )

    const response = await POST(request, { params: makeParams('customer-1') })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.content).toBe('Line 1\nLine 2')
  })
})
