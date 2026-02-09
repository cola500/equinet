import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PUT } from './route'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
}))

const mockFindByUserId = vi.fn()
vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

const mockFindById = vi.fn()
const mockUpdateProviderNotesWithAuth = vi.fn()
vi.mock('@/infrastructure/persistence/booking/PrismaBookingRepository', () => ({
  PrismaBookingRepository: class {
    findById = mockFindById
    updateProviderNotesWithAuth = mockUpdateProviderNotesWithAuth
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { auth } from '@/lib/auth-server'

const mockAuth = vi.mocked(auth)

// Helper to create request
function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/provider/bookings/booking-1/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createInvalidJsonRequest() {
  return new NextRequest('http://localhost/api/provider/bookings/booking-1/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: 'invalid json{{{',
  })
}

const params = Promise.resolve({ id: 'booking-1' })

// Mock booking data
const mockBooking = {
  id: 'booking-1',
  providerId: 'provider-1',
  customerId: 'customer-1',
  serviceId: 'service-1',
  bookingDate: new Date('2026-03-01'),
  startTime: '10:00',
  endTime: '11:00',
  status: 'confirmed',
  providerNotes: 'Test notes',
  customer: { firstName: 'Test', lastName: 'Kund', email: 'test@example.com', phone: '+46701234567' },
  service: { name: 'Hovverkare', price: 500, durationMinutes: 60 },
  horse: { id: 'horse-1', name: 'Blansen', breed: null, gender: null },
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PUT /api/provider/bookings/[id]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without session', async () => {
    mockAuth.mockResolvedValue(null as any)

    const response = await PUT(createRequest({ providerNotes: 'test' }), { params })
    expect(response.status).toBe(401)
  })

  it('returns 403 for non-provider user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as any)

    const response = await PUT(createRequest({ providerNotes: 'test' }), { params })
    expect(response.status).toBe(403)
  })

  it('returns 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })

    const response = await PUT(createInvalidJsonRequest(), { params })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Ogiltig')
  })

  it('returns 400 for Zod validation error (too long)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })

    const response = await PUT(
      createRequest({ providerNotes: 'a'.repeat(2001) }),
      { params }
    )
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Valideringsfel')
  })

  it('returns 400 for unexpected fields (strict mode)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })

    const response = await PUT(
      createRequest({ providerNotes: 'test', extraField: 'hack' }),
      { params }
    )
    expect(response.status).toBe(400)
  })

  it('returns 400 for booking with invalid status (pending)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue({ ...mockBooking, status: 'pending', providerId: 'provider-1' })

    const response = await PUT(createRequest({ providerNotes: 'test' }), { params })
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('bekraftade')
  })

  it('returns 400 for booking with invalid status (cancelled)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue({ ...mockBooking, status: 'cancelled', providerId: 'provider-1' })

    const response = await PUT(createRequest({ providerNotes: 'test' }), { params })
    expect(response.status).toBe(400)
  })

  it('returns 404 when booking not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue(null)

    const response = await PUT(createRequest({ providerNotes: 'test' }), { params })
    expect(response.status).toBe(404)
  })

  it('returns 404 for another providers booking', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue({ ...mockBooking, providerId: 'other-provider' })

    const response = await PUT(createRequest({ providerNotes: 'test' }), { params })
    expect(response.status).toBe(404)
  })

  it('returns 200 for confirmed booking with notes', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue({ ...mockBooking, status: 'confirmed', providerId: 'provider-1' })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      ...mockBooking,
      providerNotes: 'Mina anteckningar',
    })

    const response = await PUT(
      createRequest({ providerNotes: 'Mina anteckningar' }),
      { params }
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.providerNotes).toBe('Mina anteckningar')
    expect(mockUpdateProviderNotesWithAuth).toHaveBeenCalledWith(
      'booking-1',
      'Mina anteckningar',
      'provider-1'
    )
  })

  it('returns 200 for completed booking with notes', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue({ ...mockBooking, status: 'completed', providerId: 'provider-1' })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      ...mockBooking,
      status: 'completed',
      providerNotes: 'Genomförd behandling',
    })

    const response = await PUT(
      createRequest({ providerNotes: 'Genomförd behandling' }),
      { params }
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.providerNotes).toBe('Genomförd behandling')
  })

  it('returns 200 when clearing notes with null', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as any)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    mockFindById.mockResolvedValue({ ...mockBooking, status: 'confirmed', providerId: 'provider-1' })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      ...mockBooking,
      providerNotes: null,
    })

    const response = await PUT(
      createRequest({ providerNotes: null }),
      { params }
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.providerNotes).toBeNull()
    expect(mockUpdateProviderNotesWithAuth).toHaveBeenCalledWith(
      'booking-1',
      null,
      'provider-1'
    )
  })
})
