import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

// Mock dependencies
vi.mock('@/lib/auth-server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    ai: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))

const mockFindByUserId = vi.fn()
vi.mock('@/infrastructure/persistence/provider/ProviderRepository', () => ({
  ProviderRepository: class {
    findByUserId = mockFindByUserId
  },
}))

const mockUpdateProviderNotesWithAuth = vi.fn()
vi.mock('@/infrastructure/persistence/booking/PrismaBookingRepository', () => ({
  PrismaBookingRepository: class {
    updateProviderNotesWithAuth = mockUpdateProviderNotesWithAuth
  },
}))

const mockInterpretQuickNote = vi.fn()
vi.mock('@/domain/voice-log/VoiceInterpretationService', () => ({
  VoiceInterpretationService: class {
    interpretQuickNote = mockInterpretQuickNote
  },
}))

const _mockBookingFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: { findUnique: vi.fn() },
    horseNote: { create: vi.fn() },
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
import { rateLimiters } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/provider/bookings/booking-1/quick-note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createInvalidJsonRequest() {
  return new NextRequest('http://localhost/api/provider/bookings/booking-1/quick-note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'invalid json{{{',
  })
}

const params = Promise.resolve({ id: 'booking-1' })

const mockBooking = {
  id: 'booking-1',
  providerId: 'provider-1',
  customerId: 'customer-1',
  status: 'confirmed',
  providerNotes: null,
  horseId: 'horse-1',
  customer: { firstName: 'Anna', lastName: 'Johansson' },
  service: { name: 'Hovvård' },
  horse: { id: 'horse-1', name: 'Storm', breed: 'Islandshäst', specialNeeds: null },
}

describe('POST /api/provider/bookings/[id]/quick-note', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without session', async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await POST(createRequest({ transcript: 'test' }), { params })
    expect(response.status).toBe(401)
  })

  it('returns 403 for non-provider user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'customer' },
    } as never)

    const response = await POST(createRequest({ transcript: 'test' }), { params })
    expect(response.status).toBe(403)
  })

  it('returns 429 when rate limited', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    vi.mocked(rateLimiters.ai).mockResolvedValueOnce(false)

    const response = await POST(createRequest({ transcript: 'test' }), { params })
    expect(response.status).toBe(429)
  })

  it('returns 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })

    const response = await POST(createInvalidJsonRequest(), { params })
    expect(response.status).toBe(400)
  })

  it('returns 400 for missing transcript', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking)

    const response = await POST(createRequest({}), { params })
    expect(response.status).toBe(400)
  })

  it('returns 400 for extra fields (strict mode)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking)

    const response = await POST(
      createRequest({ transcript: 'test', extraField: 'hack' }),
      { params }
    )
    expect(response.status).toBe(400)
  })

  it('returns 404 when booking not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null)

    const response = await POST(createRequest({ transcript: 'test' }), { params })
    expect(response.status).toBe(404)
  })

  it('returns 404 for another providers booking', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({ ...mockBooking, providerId: 'other-provider' })

    const response = await POST(createRequest({ transcript: 'test' }), { params })
    expect(response.status).toBe(404)
  })

  it('returns 400 for booking with invalid status (pending)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({ ...mockBooking, status: 'pending' })

    const response = await POST(createRequest({ transcript: 'test' }), { params })
    expect(response.status).toBe(400)
  })

  it('saves cleaned text as providerNotes and returns result', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking)
    mockInterpretQuickNote.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        cleanedText: 'Spricka i höger framhov, korrigerade vinkeln.',
        isHealthRelated: true,
        horseNoteCategory: 'farrier',
        suggestedNextWeeks: 6,
      },
    })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      ...mockBooking,
      providerNotes: 'Spricka i höger framhov, korrigerade vinkeln.',
    })

    const response = await POST(
      createRequest({ transcript: 'Storm hade en spricka i höger framhov' }),
      { params }
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.cleanedText).toBe('Spricka i höger framhov, korrigerade vinkeln.')
    expect(data.actions).toContain('providerNotes')
    expect(mockUpdateProviderNotesWithAuth).toHaveBeenCalledWith(
      'booking-1',
      'Spricka i höger framhov, korrigerade vinkeln.',
      'provider-1'
    )
  })

  it('creates HorseNote when health-related', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking)
    mockInterpretQuickNote.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        cleanedText: 'Spricka i höger framhov.',
        isHealthRelated: true,
        horseNoteCategory: 'farrier',
        suggestedNextWeeks: null,
      },
    })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({ ...mockBooking, providerNotes: 'Spricka i höger framhov.' })

    const response = await POST(
      createRequest({ transcript: 'spricka i höger framhov' }),
      { params }
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actions).toContain('horseNote')
    expect(prisma.horseNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        horseId: 'horse-1',
        authorId: 'user-1',
        category: 'farrier',
        content: 'Spricka i höger framhov.',
      }),
    })
  })

  it('does NOT create HorseNote when not health-related', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking)
    mockInterpretQuickNote.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        cleanedText: 'Verkade alla fyra, inga anmärkningar.',
        isHealthRelated: false,
        horseNoteCategory: null,
        suggestedNextWeeks: null,
      },
    })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      ...mockBooking,
      providerNotes: 'Verkade alla fyra, inga anmärkningar.',
    })

    const response = await POST(
      createRequest({ transcript: 'verkade alla fyra inga anmärkningar' }),
      { params }
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.actions).not.toContain('horseNote')
    expect(prisma.horseNote.create).not.toHaveBeenCalled()
  })

  it('does NOT create HorseNote when no horseId on booking', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({ ...mockBooking, horseId: null, horse: null })
    mockInterpretQuickNote.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        cleanedText: 'Observation om hästen.',
        isHealthRelated: true,
        horseNoteCategory: 'general',
        suggestedNextWeeks: null,
      },
    })
    mockUpdateProviderNotesWithAuth.mockResolvedValue({
      ...mockBooking,
      horseId: null,
      providerNotes: 'Observation om hästen.',
    })

    const response = await POST(
      createRequest({ transcript: 'observation om hästen' }),
      { params }
    )
    expect(response.status).toBe(200)
    expect(prisma.horseNote.create).not.toHaveBeenCalled()
  })

  it('returns 500 when AI interpretation fails', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', userType: 'provider' },
    } as never)
    mockFindByUserId.mockResolvedValue({ id: 'provider-1' })
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking)
    mockInterpretQuickNote.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: 'INTERPRETATION_FAILED', message: 'AI error' },
    })

    const response = await POST(
      createRequest({ transcript: 'test' }),
      { params }
    )
    expect(response.status).toBe(500)
  })
})
