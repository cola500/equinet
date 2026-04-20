/**
 * @domain conversation
 * Integration tests for POST /api/bookings/[id]/messages/attachments
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// -----------------------------------------------------------
// Mocks
// -----------------------------------------------------------

const mockRepo = {
  findById: vi.fn(),
  findMany: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  findByBookingId: vi.fn(),
  createMessage: vi.fn(),
  listMessages: vi.fn(),
  markMessagesAsRead: vi.fn(),
  getUnreadCount: vi.fn(),
  getInboxForProvider: vi.fn(),
  getTotalUnreadForProvider: vi.fn(),
  deleteMessage: vi.fn(),
}

vi.mock('@/infrastructure/persistence/conversation/PrismaConversationRepository', () => ({
  PrismaConversationRepository: class {
    findById = mockRepo.findById
    findMany = mockRepo.findMany
    save = mockRepo.save
    delete = mockRepo.delete
    exists = mockRepo.exists
    findByBookingId = mockRepo.findByBookingId
    createMessage = mockRepo.createMessage
    listMessages = mockRepo.listMessages
    markMessagesAsRead = mockRepo.markMessagesAsRead
    getUnreadCount = mockRepo.getUnreadCount
    getInboxForProvider = mockRepo.getInboxForProvider
    getTotalUnreadForProvider = mockRepo.getTotalUnreadForProvider
    deleteMessage = mockRepo.deleteMessage
  },
}))

vi.mock('@/lib/auth-dual', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    messageUpload: vi.fn().mockResolvedValue(true),
  },
  RateLimitServiceError: class RateLimitServiceError extends Error {
    constructor(msg: string) { super(msg); this.name = 'RateLimitServiceError' }
  },
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/domain/conversation/loadBookingForMessaging', () => ({
  loadBookingForMessaging: vi.fn(),
}))

vi.mock('@/lib/supabase-storage', () => ({
  validateMessageAttachment: vi.fn().mockResolvedValue(null),
  uploadMessageAttachment: vi.fn().mockResolvedValue('booking-1/msg-abc.jpg'),
  deleteMessageAttachment: vi.fn().mockResolvedValue(undefined),
  createMessageSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed'),
}))

vi.mock('@/domain/notification/MessageNotifierFactory', () => ({
  createMessageNotifier: vi.fn().mockReturnValue({ notifyNewMessage: vi.fn() }),
}))

// -----------------------------------------------------------
// Import after mocks
// -----------------------------------------------------------

import { POST } from './route'
import { getAuthUser } from '@/lib/auth-dual'
import { loadBookingForMessaging } from '@/domain/conversation/loadBookingForMessaging'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { rateLimiters, RateLimitServiceError } from '@/lib/rate-limit'
import { validateMessageAttachment, uploadMessageAttachment, deleteMessageAttachment } from '@/lib/supabase-storage'

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function makeAuthUser(overrides = {}) {
  return { id: 'customer-user-1', userType: 'customer', ...overrides }
}

function makeBooking(overrides = {}) {
  return {
    id: 'booking-1',
    customerId: 'customer-user-1',
    providerId: 'provider-1',
    providerUserId: 'provider-user-1',
    status: 'confirmed',
    bookingDate: new Date('2026-04-20'),
    customerName: 'Anna Karlsson',
    providerName: 'Hovslageri AB',
    serviceName: 'Hovvård',
    ...overrides,
  }
}

function makeMessage(overrides = {}) {
  return {
    id: 'msg-abc',
    conversationId: 'conv-1',
    senderType: 'CUSTOMER',
    senderId: 'customer-user-1',
    content: '',
    createdAt: new Date(),
    readAt: null,
    attachmentUrl: 'booking-1/msg-abc.jpg',
    attachmentType: 'image/jpeg',
    attachmentSize: 204800,
    ...overrides,
  }
}

function makeFormDataRequest(bookingId: string, fileContent = 'fake-image-data', mimeType = 'image/jpeg') {
  const formData = new FormData()
  const file = new File([fileContent], 'photo.jpg', { type: mimeType })
  formData.append('file', file)
  return new NextRequest(`http://localhost/api/bookings/${bookingId}/messages/attachments`, {
    method: 'POST',
    body: formData,
  })
}

function makeRequestWithContentLength(bookingId: string, contentLength: number) {
  const formData = new FormData()
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
  formData.append('file', file)
  return new NextRequest(`http://localhost/api/bookings/${bookingId}/messages/attachments`, {
    method: 'POST',
    body: formData,
    headers: { 'content-length': String(contentLength) },
  })
}

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('POST /api/bookings/[id]/messages/attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(rateLimiters.messageUpload).mockResolvedValue(true)
    vi.mocked(validateMessageAttachment).mockResolvedValue(null)
    vi.mocked(uploadMessageAttachment).mockResolvedValue('booking-1/msg-abc.jpg')
    vi.mocked(deleteMessageAttachment).mockResolvedValue(undefined)
    mockRepo.createMessage.mockResolvedValue(makeMessage())
    mockRepo.deleteMessage.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when messaging feature is disabled', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(rateLimiters.messageUpload).mockResolvedValue(false)
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(429)
  })

  it('returns 404 when booking not found or not owned by user', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(null)
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no file is attached', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    const formData = new FormData()
    const req = new NextRequest('http://localhost/api/bookings/booking-1/messages/attachments', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when MIME type is invalid', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    vi.mocked(validateMessageAttachment).mockResolvedValue({
      code: 'INVALID_TYPE',
      message: 'Filtypen stöds inte.',
    })
    const req = makeFormDataRequest('booking-1', 'data', 'application/pdf')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Filtypen')
  })

  it('returns 201 with message data on success', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.attachmentUrl).toBe('booking-1/msg-abc.jpg')
    expect(data.attachmentType).toBe('image/jpeg')
  })

  it('calls deleteMessage when upload fails (rollback)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    vi.mocked(uploadMessageAttachment).mockRejectedValue(new Error('Upload failed'))
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(500)
    expect(mockRepo.deleteMessage).toHaveBeenCalledWith('msg-abc')
  })

  it('provider can also upload an attachment', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser({ userType: 'provider' }) as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    mockRepo.createMessage.mockResolvedValue(makeMessage({ senderType: 'PROVIDER' }))
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(201)
  })

  it('returns 413 when Content-Length header exceeds 10 MB', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    const overLimit = 10 * 1024 * 1024 + 1
    const req = makeRequestWithContentLength('booking-1', overLimit)
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(413)
  })

  it('returns 413 when validateMessageAttachment returns TOO_LARGE', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    vi.mocked(validateMessageAttachment).mockResolvedValue({
      code: 'TOO_LARGE',
      message: 'Filen är för stor. Max 10 MB.',
    })
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(413)
  })

  it('returns 400 when validateMessageAttachment returns MAGIC_BYTES_MISMATCH', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    vi.mocked(validateMessageAttachment).mockResolvedValue({
      code: 'MAGIC_BYTES_MISMATCH',
      message: 'Filinnehållet matchar inte det deklarerade formatet.',
    })
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('matchar inte')
  })

  it('returns 503 when rate limiter throws RateLimitServiceError', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(rateLimiters.messageUpload).mockRejectedValue(
      new RateLimitServiceError('Redis unavailable')
    )
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    expect(res.status).toBe(503)
  })

  it('logs error and returns 500 when rollback deleteMessage also fails', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(makeAuthUser() as never)
    vi.mocked(loadBookingForMessaging).mockResolvedValue(makeBooking() as never)
    vi.mocked(uploadMessageAttachment).mockRejectedValue(new Error('Upload failed'))
    mockRepo.deleteMessage.mockRejectedValue(new Error('DB gone'))
    const req = makeFormDataRequest('booking-1')
    const res = await POST(req, { params: Promise.resolve({ id: 'booking-1' }) })
    // Should still return 500, not crash
    expect(res.status).toBe(500)
  })
})
